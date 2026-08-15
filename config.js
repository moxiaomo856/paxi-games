// ============================================================
// PAXI 游戏平台 全局配置
// 管理员：在大厅点「⚙️ 管理」，连接管理员钱包后可修改规则并
// 生成新的 config.js，替换仓库根目录同名文件并提交即生效。
// ============================================================
window.PAXI_CONFIG = {
  "chainId": "paxi-mainnet",
  "chainName": "Paxi Chain",
  "rpcEndpoint": "https://mainnet-rpc.paxinet.io",
  "restEndpoint": "https://mainnet-lcd.paxinet.io",
  "denom": "upaxi",
  "displayDenom": "PAXI",
  "decimals": 6,
  "sdkUrl": "https://mainnet-api.paxinet.io/resources/js/paxi-cosmjs.umd.js",
  "adminAddress": "paxi1rdarmm997hqwfdgl9wvnpffe28zmex3kfyg7xd",
  "chargeEnabled": false,
  "entryFee": 5,
  "entryRounds": 2,
  "freeRevives": 2,
  "reviveSingle": 3,
  "reviveDouble": 5,
  "doubleReviveCount": 2,
  "payeeAddresses": [
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
  ],
  "prc20": {
    "enabled": false,
    "contract": "",
    "symbol": "TOKEN",
    "decimals": 6,
    "entryAmount": 100000,
    "reviveSingleAmount": 50000,
    "reviveDoubleAmount": 100000
  }
};