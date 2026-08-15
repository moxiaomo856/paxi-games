/**
 * PaxiCosmJS 兼容层
 *
 * 问题：Paxi 官方 SDK (paxi-cosmjs.umd.js) 仅包含 Cosmos tx 模块
 *（TxBody/AuthInfo/SignDoc/TxRaw/Any/Coin），缺少 bank/wasm 模块的消息类
 *（MsgSend/MsgExecuteContract/MsgInstantiateContract/PubKey/coins）。
 *
 * 本文件在 SDK 加载后检测缺失的类，用手写 protobuf 编码器补充，
 * 确保代码在 SDK 缺失关键类时仍能正常运行。
 *
 * 编码已通过 protobufjs 官方库逐字节验证。
 */
(function () {
  'use strict';

  // ============================================================
  // protobuf 基础编码函数
  // ============================================================

  function encodeVarint(n) {
    const bytes = [];
    n = BigInt(n);
    if (n === 0n) return new Uint8Array([0]);
    while (n > 0n) {
      let byte = Number(n & 0x7fn);
      n >>= 7n;
      if (n > 0n) byte |= 0x80;
      bytes.push(byte);
    }
    return new Uint8Array(bytes);
  }

  /** 编码 length-delimited 字段 (wire type 2) */
  function encodeLenDelim(fieldNum, data) {
    const tag = (fieldNum << 3) | 2;
    const dataBytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    return concatBytes(encodeVarint(tag), encodeVarint(dataBytes.length), dataBytes);
  }

  /** 编码 varint 字段 (wire type 0) */
  function encodeVarintField(fieldNum, value) {
    const tag = (fieldNum << 3) | 0;
    return concatBytes(encodeVarint(tag), encodeVarint(value));
  }

  /** 拼接多个 Uint8Array */
  function concatBytes(...arrays) {
    const total = arrays.reduce((s, a) => s + a.length, 0);
    const result = new Uint8Array(total);
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }

  // ============================================================
  // Coin 编码
  // ============================================================
  function encodeCoin(denom, amount) {
    return concatBytes(encodeLenDelim(1, denom), encodeLenDelim(2, amount));
  }

  // ============================================================
  // coins 辅助函数（替代 PaxiCosmJS.coins）
  // ============================================================
  function coins(amount, denom) {
    return [{ denom, amount: String(amount) }];
  }

  // ============================================================
  // MsgSend 编码
  // protobuf: cosmos.bank.v1beta1.MsgSend
  // { string from_address = 1; string to_address = 2; repeated Coin amount = 3; }
  // ============================================================
  const MsgSend = {
    fromPartial(data) { return data; },
    encode(data) {
      const fromAddress = data.fromAddress || data.from_address;
      const toAddress = data.toAddress || data.to_address;
      const parts = [
        encodeLenDelim(1, fromAddress),
        encodeLenDelim(2, toAddress),
      ];
      // amount 是 repeated Coin
      if (data.amount && data.amount.length > 0) {
        for (const coin of data.amount) {
          const coinBytes = encodeCoin(coin.denom, coin.amount);
          parts.push(encodeLenDelim(3, coinBytes));
        }
      }
      return { finish: () => concatBytes(...parts) };
    },
  };

  // ============================================================
  // MsgExecuteContract 编码
  // protobuf: cosmwasm.wasm.v1.MsgExecuteContract
  // { string sender = 1; string contract = 2; bytes msg = 3; repeated Coin funds = 5; }
  // 注意：funds 是 field 5（field 4 被保留）
  // ============================================================
  const MsgExecuteContract = {
    fromPartial(data) { return data; },
    encode(data) {
      const sender = data.sender || data.sender_address;
      const contract = data.contract || data.contract_addr;
      const msg = data.msg || new Uint8Array();
      const parts = [
        encodeLenDelim(1, sender),
        encodeLenDelim(2, contract),
        encodeLenDelim(3, msg),
      ];
      if (data.funds && data.funds.length > 0) {
        for (const coin of data.funds) {
          const coinBytes = encodeCoin(coin.denom, coin.amount);
          parts.push(encodeLenDelim(5, coinBytes));
        }
      }
      return { finish: () => concatBytes(...parts) };
    },
  };

  // ============================================================
  // MsgInstantiateContract 编码
  // protobuf: cosmwasm.wasm.v1.MsgInstantiateContract
  // { string sender = 1; string admin = 2; uint64 code_id = 3; string label = 4; bytes msg = 5; repeated Coin funds = 6; }
  // ============================================================
  const MsgInstantiateContract = {
    fromPartial(data) { return data; },
    encode(data) {
      const parts = [
        encodeLenDelim(1, data.sender),
        encodeLenDelim(2, data.admin || ''),
        encodeVarintField(3, data.codeId || data.code_id || 0),
        encodeLenDelim(4, data.label || ''),
        encodeLenDelim(5, data.msg || new Uint8Array()),
      ];
      if (data.funds && data.funds.length > 0) {
        for (const coin of data.funds) {
          const coinBytes = encodeCoin(coin.denom, coin.amount);
          parts.push(encodeLenDelim(6, coinBytes));
        }
      }
      return { finish: () => concatBytes(...parts) };
    },
  };

  // ============================================================
  // PubKey 编码 (secp256k1)
  // protobuf: cosmos.crypto.secp256k1.PubKey
  // { bytes key = 1; }
  // ============================================================
  const PubKey = {
    encode(data) {
      return { finish: () => encodeLenDelim(1, data.key) };
    },
  };

  // ============================================================
  // Any 编码（用于 Grant 内嵌套的 authorization 字段）
  // protobuf: google.protobuf.Any
  // { string type_url = 1; bytes value = 2; }
  // ============================================================
  const AnyEncode = {
    encode(data) {
      return {
        finish: () => concatBytes(
          encodeLenDelim(1, data.typeUrl),
          encodeLenDelim(2, data.value),
        ),
      };
    },
  };

  // ============================================================
  // GenericAuthorization 编码
  // protobuf: cosmos.authz.v1beta1.GenericAuthorization
  // { string msg = 1; }  // msg = 授权的消息类型 typeUrl
  // ============================================================
  const GenericAuthorization = {
    fromPartial(data) { return data; },
    encode(data) {
      return { finish: () => encodeLenDelim(1, data.msg) };
    },
  };

  // ============================================================
  // Timestamp 编码
  // protobuf: google.protobuf.Timestamp
  // { int64 seconds = 1; int32 nanos = 2; }
  // ============================================================
  const Timestamp = {
    fromPartial(data) { return data; },
    encode(data) {
      return {
        finish: () => concatBytes(
          encodeVarintField(1, data.seconds),
          encodeVarintField(2, data.nanos || 0),
        ),
      };
    },
  };

  // ============================================================
  // Grant 编码
  // protobuf: cosmos.authz.v1beta1.Grant
  // { Any authorization = 1; Timestamp expiration = 2; }
  // ============================================================
  const Grant = {
    fromPartial(data) { return data; },
    encode(data) {
      const authBytes = AnyEncode.encode(data.authorization).finish();
      const expBytes = Timestamp.encode(data.expiration).finish();
      return {
        finish: () => concatBytes(
          encodeLenDelim(1, authBytes),
          encodeLenDelim(2, expBytes),
        ),
      };
    },
  };

  // ============================================================
  // MsgGrant 编码 — 授权
  // protobuf: cosmos.authz.v1beta1.MsgGrant
  // { string granter = 1; string grantee = 2; Grant grant = 3; }
  // ============================================================
  const MsgGrant = {
    fromPartial(data) { return data; },
    encode(data) {
      const grantBytes = Grant.encode(data.grant).finish();
      return {
        finish: () => concatBytes(
          encodeLenDelim(1, data.granter),
          encodeLenDelim(2, data.grantee),
          encodeLenDelim(3, grantBytes),
        ),
      };
    },
  };

  // ============================================================
  // MsgExec 编码 — 代执行
  // protobuf: cosmos.authz.v1beta1.MsgExec
  // { string grantee = 1; repeated Any msgs = 2; }
  // ============================================================
  const MsgExec = {
    fromPartial(data) { return data; },
    encode(data) {
      const parts = [encodeLenDelim(1, data.grantee)];
      if (data.msgs) {
        for (const msg of data.msgs) {
          const anyBytes = AnyEncode.encode(msg).finish();
          parts.push(encodeLenDelim(2, anyBytes));
        }
      }
      return { finish: () => concatBytes(...parts) };
    },
  };

  // ============================================================
  // MsgUpdateAdmin 编码
  // protobuf: cosmwasm.wasm.v1.MsgUpdateAdmin
  // { string sender = 1; string new_admin = 2; string contract = 3; }
  // ============================================================
  const MsgUpdateAdmin = {
    fromPartial(data) { return data; },
    encode(data) {
      return {
        finish: () => concatBytes(
          encodeLenDelim(1, data.sender),
          encodeLenDelim(2, data.newAdmin),
          encodeLenDelim(3, data.contract),
        ),
      };
    },
  };

  // ============================================================
  // MsgMigrateContract 编码
  // protobuf: cosmwasm.wasm.v1.MsgMigrateContract
  // { string sender = 1; string contract = 2; uint64 code_id = 3; bytes msg = 4; }
  // ============================================================
  const MsgMigrateContract = {
    fromPartial(data) { return data; },
    encode(data) {
      return {
        finish: () => concatBytes(
          encodeLenDelim(1, data.sender),
          encodeLenDelim(2, data.contract),
          encodeVarintField(3, data.codeId || 0),
          encodeLenDelim(4, data.msg || new Uint8Array()),
        ),
      };
    },
  };

  // ============================================================
  // MsgRevoke 编码 — 撤销授权
  // protobuf: cosmos.authz.v1beta1.MsgRevoke
  // { string granter = 1; string grantee = 2; string msg_type_url = 3; }
  // ============================================================
  const MsgRevoke = {
    fromPartial(data) { return data; },
    encode(data) {
      return {
        finish: () => concatBytes(
          encodeLenDelim(1, data.granter),
          encodeLenDelim(2, data.grantee),
          encodeLenDelim(3, data.msgTypeUrl),
        ),
      };
    },
  };

  // ============================================================
  // MsgBeginRedelegate 编码 — 质押迁移
  // protobuf: cosmos.staking.v1beta1.MsgBeginRedelegate
  // { string delegator_address = 1; string validator_src_address = 2; string validator_dst_address = 3; Coin amount = 4; }
  // 兼容 snake_case (app.js) 和 camelCase (SDK 风格) 两种字段名
  // ============================================================
  const MsgBeginRedelegate = {
    fromPartial(data) { return data; },
    encode(data) {
      const delegatorAddress = data.delegator_address || data.delegatorAddress;
      const validatorSrcAddress = data.validator_src_address || data.validatorSrcAddress;
      const validatorDstAddress = data.validator_dst_address || data.validatorDstAddress;
      const parts = [
        encodeLenDelim(1, delegatorAddress),
        encodeLenDelim(2, validatorSrcAddress),
        encodeLenDelim(3, validatorDstAddress),
      ];
      if (data.amount) {
        const coinBytes = encodeCoin(data.amount.denom, data.amount.amount);
        parts.push(encodeLenDelim(4, coinBytes));
      }
      return { finish: () => concatBytes(...parts) };
    },
  };

  // ============================================================
  // TextProposal 编码 — 治理文本提案内容
  // protobuf: cosmos.gov.v1beta1.TextProposal
  // { string title = 1; string description = 2; }
  // ============================================================
  const TextProposal = {
    fromPartial(data) { return data; },
    encode(data) {
      return {
        finish: () => concatBytes(
          encodeLenDelim(1, data.title || ''),
          encodeLenDelim(2, data.description || ''),
        ),
      };
    },
  };

  // ============================================================
  // ParamChange 编码 — 参数修改提案中的单个参数项
  // protobuf: cosmos.params.v1beta1.ParamChange
  // { string subspace = 1; string key = 2; string value = 3; }
  // ============================================================
  const ParamChange = {
    fromPartial(data) { return data; },
    encode(data) {
      const parts = [];
      if (data.subspace) parts.push(encodeLenDelim(1, data.subspace));
      if (data.key) parts.push(encodeLenDelim(2, data.key));
      if (data.value != null) parts.push(encodeLenDelim(3, String(data.value)));
      return { finish: () => concatBytes(...parts) };
    },
  };

  // ============================================================
  // ParameterChangeProposal 编码 — 治理参数修改提案
  // protobuf: cosmos.params.v1beta1.ParameterChangeProposal
  // { string title = 1; string description = 2; repeated ParamChange changes = 3; }
  // ============================================================
  const ParameterChangeProposal = {
    fromPartial(data) { return data; },
    encode(data) {
      const parts = [
        encodeLenDelim(1, data.title || ''),
        encodeLenDelim(2, data.description || ''),
      ];
      if (data.changes && Array.isArray(data.changes)) {
        for (const c of data.changes) {
          const cBytes = ParamChange.encode(c).finish();
          parts.push(encodeLenDelim(3, cBytes));
        }
      }
      return { finish: () => concatBytes(...parts) };
    },
  };

  // ============================================================
  // MsgSubmitProposal 编码 — 治理提交提案
  // protobuf: cosmos.gov.v1beta1.MsgSubmitProposal
  // { Any content = 1; repeated Coin initial_deposit = 2; string proposer = 3; }
  // ============================================================
  const MsgSubmitProposal = {
    fromPartial(data) { return data; },
    encode(data) {
      const parts = [];
      if (data.content) {
        const anyBytes = AnyEncode.encode(data.content).finish();
        parts.push(encodeLenDelim(1, anyBytes));
      }
      if (data.initial_deposit || data.initialDeposit) {
        const deposit = data.initial_deposit || data.initialDeposit || [];
        for (const coin of deposit) {
          const coinBytes = encodeCoin(coin.denom, coin.amount);
          parts.push(encodeLenDelim(2, coinBytes));
        }
      }
      if (data.proposer) {
        parts.push(encodeLenDelim(3, data.proposer));
      }
      return { finish: () => concatBytes(...parts) };
    },
  };

  // ============================================================
  // 兼容层入口：检测并补充缺失的类
  // ============================================================
  function applyCompat() {
    if (typeof window.PaxiCosmJS === 'undefined') {
      console.error('[Compat] PaxiCosmJS 未加载，兼容层无法应用');
      return;
    }

    const supplement = {
      MsgSend,
      MsgExecuteContract,
      MsgInstantiateContract,
      PubKey,
      coins,
      GenericAuthorization,
      Timestamp,
      Grant,
      MsgGrant,
      MsgExec,
      MsgRevoke,
      MsgUpdateAdmin,
      MsgMigrateContract,
      MsgBeginRedelegate,
      TextProposal,
      ParamChange,
      ParameterChangeProposal,
      MsgSubmitProposal,
    };

    let added = [];
    for (const [name, impl] of Object.entries(supplement)) {
      if (typeof window.PaxiCosmJS[name] === 'undefined') {
        window.PaxiCosmJS[name] = impl;
        added.push(name);
      }
    }

    if (added.length > 0) {
      console.log('[Compat] 已补充缺失的类:', added.join(', '));
    } else {
      console.log('[Compat] PaxiCosmJS SDK 完整，无需补充');
    }
  }

  // 在 DOM 加载后执行（确保 SDK 已加载）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyCompat);
  } else {
    applyCompat();
  }
})();
