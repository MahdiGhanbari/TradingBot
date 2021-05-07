const ACCESS_ID = "EFB8BBFBD340401FB8C24AC8D95BF339"
const SECRET_KEY = "8E1288D2C6E31020CED1C33723E9C31FF955B8E12A969127"
import Axios from 'axios'
import crypto from 'crypto'


function createDictText(params) {
  var keys = Object.keys(params).sort();
  var qs = keys[0] + "=" + params[keys[0]];
  for (var i = 1; i < keys.length; i++) {
    qs += "&" + keys[i] + "=" + params[keys[i]];
  }
  return qs;
}


function createAuthorization(params) {
  var text = createDictText(params) + "&secret_key=" + SECRET_KEY;
  return crypto
    .createHash("md5")
    .update(text)
    .digest("hex")
    .toUpperCase();
}

const axios = Axios.create({
  baseURL: "v1",
  headers: {
    // "User-Agent":
    //   "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.71 Safari/537.36",
    post: {
      "Content-Type": "application/json",
    },
  },
  timeout: 10000,
})

export async function cancelAllOrder(market) {
  const params = {
    account_id: 0,
    market,
    tonce: Date.now(),
    access_id: ACCESS_ID,
  }
  return await axios.delete("/order/pending", {
    headers: {
      authorization: createAuthorization(params)
    },
    params
  })
}

export async function getMaketInfo() {
  const res = await axios.get("/market/info")
  return res.data.data
}

export async function getAccountInfo() {
  const params = {
    access_id: ACCESS_ID,
    tonce: Date.now()
  };
  return await axios.get("/balance/info", {
    headers: {
      authorization: createAuthorization(params),
    },
    params: params
  });
}


export async function getHistory(market, page = 1, limit = 10) {
  const params = {
    page, 
    limit,
    account_id: -1,
    access_id: ACCESS_ID
  };
  return await axios.get("/order/finished", {
    headers: {
      authorization: createAuthorization(params),
    },
    params
  })
}


export async function placeLimitOrder(type, market, price, amount) {
  const data = {
    access_id: ACCESS_ID,
    tonce: Date.now(),
    account_id: 0,
    market,
    type,
    amount: amount + '',
    price: price + '',
  };
  const res = await axios.post("/order/limit", data, {
    headers: {
      authorization: createAuthorization(data),
    },
  });
  return res
}


export async function acquireKLineData(market, type, limit) {
  const params = {
    market,
    type,
    limit,
  };
  const res = await axios.get("/market/kline", {
    headers: {
      authorization: createAuthorization(params),
    },
    params
  })
  return res.data.data
}


export async function placeMarketOrder(type, market, amount) {
  const data = {
    access_id: ACCESS_ID,
    tonce: Date.now(),
    account_id: 0,
    market,
    type,
    amount: amount + '',
  }
  console.log(type, market, amount)
  const res = await axios.post("/order/market", data, {
    headers: {
      authorization: createAuthorization(data),
    }
  })
}

async function getPendingOrder() {
  const params = {
    access_id: ACCESS_ID,
    tonce: Date.now(),
    account_id: 0,
    market: "BTCUSDT",
    page: 1,
    limit: 10
  };
  const res = await axios.get("/order/pending", {
    headers: {
      authorization: createAuthorization(params),
    },
    params: params
  });
  const pendingOrders = res.data.code === 0 ? res.data.data.data : [];
  console.log("pending orders:\n", JSON.stringify(res.data, null, 2));
  return pendingOrders;
}


export async function cancelOrder(market, id) {
  const params = {
    account_id: 0,
    tonce: Date.now(),
    market: market,
    id: id,
    access_id: ACCESS_ID,
  }
  return await axios.delete("/order/pending", {
    params: params,
    headers: {
      authorization: createAuthorization(params),
    },
  })
}

export async function acquireOrderStatus(market, id) {
  const params = {
    id: id,
    access_id: ACCESS_ID,
    market: market,
    tonce: Date.now(),
  }
  return await axios.delete("/order/pending", {
    params,
    headers: {
      authorization: createAuthorization(params),
    },
  })
}
