// ============================================================
// PAXI 游戏平台 全局配置
// 管理员：在大厅点「⚙️ 管理」，连接管理员钱包后可修改规则并
// 生成新的 config.js，替换仓库根目录同名文件并提交即生效。
// ============================================================
window.PAXI_CONFIG = {
  // ---- 区块链网络（Paxi 主网）----
  chainId: "paxi-mainnet",
  chainName: "Paxi Chain",
  rpcEndpoint: "https://mainnet-rpc.paxinet.io",
  restEndpoint: "https://mainnet-lcd.paxinet.io",   // LCD
  denom: "upaxi",              // 链上最小单位
  displayDenom: "PAXI",        // 显示名称
  decimals: 6,                 // 1 PAXI = 1000000 upaxi
  sdkUrl: "https://mainnet-api.paxinet.io/resources/js/paxi-cosmjs.umd.js",

  // ---- 管理员（连接此钱包可进入管理面板改规则）----
  adminAddress: "paxi1rdarmm997hqwfdgl9wvnpffe28zmex3kfyg7xd",

  // ---- 收费开关（false = 调试模式，全部免费）----
  chargeEnabled: true,

  // ---- 付费规则 ----
  entryFee: 5,            // 入场费（PAXI）
  entryRounds: 2,         // 一次入场可玩局数
  freeRevives: 2,         // 每个玩家累计免费复活次数
  reviveSingle: 3,        // 单次复活（PAXI）
  reviveDouble: 5,        // 优惠复活（PAXI）
  doubleReviveCount: 2,   // 优惠复活获得次数

  // ---- PRC20 代币（双币付费）----
  // 代币发布后：把 enabled 改为 true 并填入 contract 合约地址即可启用。
  // 启用后：入场 = 5 PAXI + 100,000 代币玩 2 局；
  //         复活1次 = 3 PAXI + 50,000；复活2次 = 5 PAXI + 100,000。
  prc20: {
    enabled: false,       // ⬅ 代币发布后改为 true
    contract: "",         // ⬅ PRC20 合约地址（发布后填入）
    symbol: "TOKEN",      // 显示符号（改成你的代币名）
    decimals: 6,          // 代币精度（按合约实际填）
    entryAmount: 100000,      // 入场代币数量
    reviveSingleAmount: 50000,   // 单次复活代币数量
    reviveDoubleAmount: 100000   // 优惠复活代币数量
    ,airdropAmount: 10000,      // 空投：每个地址可免费领取的代币数量
    faucetAddress: ""            // 空投发送钱包（留空=管理员地址）
  },

  // ---- 收款地址池（每次支付随机选一个，PAXI 与代币同笔交易转同一地址）----
  payeeAddresses: [
    "paxi1ngut7ymp4cmzu7drjrc2gv7rhtnq4p0u6cgl0g",
    "paxi1kg0fzzyldr5ldggd8hhvvmyhg9xx3j3uvkn8eg",
    "paxi1m62c5kqs0marmv54scz88nw4cx4k06yehd92fk",
    "paxi120u6khy4n4yk89vmmkynl8r6yruen6sd7k47pe",
    "paxi1c2z42224lqss50t5mme36nmu22r4fwef4rlwxu",
    "paxi19qfjacug75d4jkj5d7r8maachnezgwus0w8wup",
    "paxi164lc3lq67u9ghkuy0k2aa7xcun4al23putcmzn",
    "paxi1hm83zslpckq2xrnsgk3qswksll6esc76suf9sw",
    "paxi16smk5dq5qwyqvhkchrrwxhg9e2w7cvxpsx9f49",
    "paxi194kpjqhyz7re2g749lc2030cgeg4sql5ldvyem",
    "paxi1ykgjrygltdctjlthmhvzv09h3yey0acefmyfnm"
  ]
};
