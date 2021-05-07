<template>
  <div :class="{active: isTradingActive}">
    <div class="horizontal">
      <div v-if="candle" class="vertical fill" :style="{color: candle.isRed ? 'red' : 'green'}">
        <div class="horizontal">
          <div class="fill">O: {{candle.open}}</div>
          <div class="fill">H: {{candle.high}}</div>
          <div class="fill">L: {{candle.low}}</div>
          <div class="fill">C: {{candle.close}}</div>
          <div class="fill">Diff: {{candle.diff.toFixed(4)}}</div>
        </div>
        <div class="candle">
          <div class="line"></div>
          <div class="rect" :style="candleStyle"></div>
        </div>
        <!-- <div>{{new Date(candle.time * 1000).getUTCHours() + ':' + candle.time.getUTCMinutes()}}</div> -->
      </div>
      <div class="fill settings">
        <div class="horizontal">
          <div class="horizontal">
            <div>Market: </div>
            <input list="browsers" :placeholder="selectedMarket.name" class="drop-down" @input="selectMarket">
            <datalist id="browsers">
              <option v-for="(market, name) of markets" :key="name" :value="name"/>
            </datalist>
          </div>
          <div class="horizontal">
            <!-- <div>Leverages: </div>
            <select v-model="leverage" class="drop-down">
              <option v-for="market of selectedMarket" :key="market" :value="market">{{market}}</option>
            </select> -->
          </div>
          <div class="horizontal">
            <div>Time Frame: </div>
            <select v-model="selectedTimeFrame" class="drop-down">
              <option v-for="name of timeFrames" :key="name" :value="name">{{name}}</option>
            </select>
          </div>
          <div class="horizontal">
            <div>Start Price: </div>
            <input v-model="StartPrice" type="number" class="input-value"/>
          </div>
        </div>
        <div class="horizontal">
          <div class="horizontal">
            <div>Orders:</div>
            <div class="order-list"><div v-for="order of orders" :key="order">{{order}}</div></div>
          </div>
        </div>
      </div>
    </div>
    <div>
      <button @click="start" class="start-btn">{{`${isTradingActive ? 'Stop':'Start'} Trade`}}</button>
      <div class="current-time">{{time}} (UTC)</div>
    </div>
  </div>
</template>

<script>
import {
  getMaketInfo,
  acquireKLineData,
  acquireOrderStatus,
  getAccountInfo,
  getHistory,
  placeMarketOrder,
  cancelAllOrder,
  cancelOrder
} from './plugins/api'

class Order {
  constructor(type, market, amount) {
    this.market = market
    this.amount = this.amount
    this.data = null
    this.status = 'not_deal'
    this.type = type
  }

  async run() {
    try {
      console.log('run', this.amount, this.market.min_amount)
      if(this.amount >= this.market.min_amount) {
        const res = await placeMarketOrder(this.type, this.market.name, this.amount)
        console.log(res)
        if(res.message === 'ok') {
          this.data = res.data
          this.status = res.data.status
          console.log('order>>',this.type,this.data.price)
          return true
        }
      } 
    } catch(e) {
      console.log(e)
      return Promise.reject()
    }
  }

  async update() {
    if (this.data && this.status == 'not_deal') {
      const res = await acquireOrderStatus(this.market, this.data.id).data
      if (res.message === 'success' && res.data.status != 'done') {
        const cancellRes = await cancelOrder(this.market, this.data.id)
        if (cancellRes.message == 'ok') {
          this.run()
        }
      }
    }
  }

}

const TIME = 0, OPEN = 1, CLOSE = 2, HIGH = 3, LOW = 4, VOLUME = 5, AMOUNT = 6

export default {
  name: 'App',
  data() {
    return {
      markets: {},
      timeFrames: ['5min','15min','30min'],
      selectedMarket: {},
      selectedTimeFrame: '5min',
      isTradingActive: false,
      StartPrice: -5,
      candle: {
        time : null,
        open: 0,
        close: 0,
        high: 0,
        low: 0,
        diff: 0,
        isRed: false,
        isUsed: false
      },
      orders: [],
      time: 0,
      exeStack: [],
      unExeStack: [],
      isFirstInit: true,
      minProfit: 0.01,
      maxAscSlop: 0,
      maxDesSlop: 0,
      currentOrder: null,
      availables: [],
      latesTime: 0,
      count: 0,
      isChartAsc: false,
      ordersForSell: [],
      maxStep: 8,
      minStep: 2,
      sellPoints: new Map(),
      interval: null
    }
  },
  methods: {
    async trader() {  
      if (this.isTradingActive) {
        console.log('trading')
        // candle counter
        if (this.latesTime != this.candle.time) {
          this.latesTime = this.candle.time
          this.count++
          this.candle.isUsed = false
          await this.updateBuySteps()
        }
        // update the limiters every 10 candles
        if (this.count > 10 && this.count % 10 == 0) {
          await this.updateLimiters()
        }
        // check the current order is done or need to update
        if (this.currentOrder || this.candle.isUsed) {
          if (this.candle.isUsed) {
            console.log('Then candle is used wating for next cnadel ....', this.count)
          } else if (this.currentOrder.status == 'done') {
            console.log('check current order', this.currentOrder.status)
            console.log(this.currentOrder)
            if (this.currentOrder.type == 'buy') {
              this.exeStack.push(currentOrder)
            }
          } else {
            this.currentOrder.update(this.candle.close)
          }
        } else if (this.candle.isRed) {
          if (this.isChartAsc) {
            console.log('check for sell')
            while(this.exeStack.length > 0) {
              const exeOrder = this.exeStack.pop()
              const price = this.candle.close  * exeOrder.amount
              const fee = price * this.selectedMarket.maker_fee_rate
              const finalPrice = price  - fee
              const diff = exeOrder.price - this.candle.close
              // check to be positive of the difference between prices and to be bigger than minimal profit
              if (diff < 0 && (Math.abs(diff) / exeOrder.price) > this.minProfit) {
                // it is a executed oreder for sell
                this.ordersForSell.push(exeOrder)
              } else {
                this.exeStack.push(exeOrder)
                break;
              }
            }
            // check candle for sell
            if (this.ordersForSell.length) {
              const amount = this.ordersForSell.reduce((acc, value) => acc + value.ammount, 0)
              const currentStep = this.convertSlopToStep(await this.getCurrentSlop())
              const breakPoint = this.sellPoints.get(currentStep)
              const diffHO = this.candle.high - this.candle.open
              // check sell parameters 
              if (breakPoint && diffHO <= breakPoint.diffHO && this.candle.volum <= breakPoint.volum ) {
                console.log('can sell')
                const sellOrder = new Order('sell', this.selectedMarket, amount)
                const res = await sellOrder.run(this.candle.close)
                if (res) {
                  this.currentOrder = sellOrder
                  this.candle.isUsed = true
                } else {
                  this.exeStack.push(...this.ordersForSell.reverse())
                  this.ordersForSell = []
                }
              }
            } else {
              // buy in the read candle by the close field 
              console.log('buy while the cnadle is read and chart is asc')
              await this.buy()
            }
          }
        } else if (!this.isChartAsc ) {
          // buy while the chart is des in green candle
            console.log('buy while the chart is des in green candle')
            await this.buy()
        }
      } else {
        if(this.interval) {
          clearInterval(this.interval)
        }
        if (this.currentOrder && this.currentOrder.type == 'sell' && this.currentOrder.status != 'done') {
          // TODO: check resoult that response be success
            this.count = 0
            this.currentOrder = null
            this.candle.isUsed = false
            this.exeStack.push(...this.ordersForSell.reverse())
            await cancelAllOrder(this.selectedMarket.name)
        }
      }
    },
    async buy() {
      if (this.availables.length) {
        const available = this.availables.pop()
        console.log('buy method> availabel', available, this.availables.length)
        const buyOrder = new Order('buy', this.selectedMarket, available)
        const res = await buyOrder.run()
        console.log(res)
        if (res) {
          this.currentOrder = buyOrder
          this.candle.isUsed = true
        } else {
          this.availables.push(available)
        }
      }
    },
    async updateLimiters() {
      const n = 1000
      const bridgeLength = 3
      const data = await acquireKLineData(this.selectedMarket.name, this.selectedTimeFrame, n)
      this.maxAscSlop = this.maxDesSlop = 0
      let current = data[0][HIGH]
      let start = current, end = current, max= null, totoalDiff = 0
      let ascList = [], desList = [], res = []
      const reset  = v => {
        start = end = v
        max = null
        ascList = []
        desList = []
      }
      for (let i = 0; i < n; i++) {
        current = Number.parseFloat(data[i][HIGH])
        if (!max && start >= current) {
          start = current
        } else if (max <= current) {
          max = current
          desList = []
          ascList.push(data[i])
        } else if (end >= current || (desList.length <= bridgeLength && current < max)) {
          end = current
          desList.push(data[i])
        } else if (ascList.length > bridgeLength && desList.length > bridgeLength) {
          // extracting slops and min and max slop
          // save extracted data
          const ascSlop = this.getSlop(ascList, HIGH)
          const desSlop = this.getSlop(desList, HIGH)
          this.maxAscSlop = ascSlop < this.maxAscSlop ? ascSlop : this.maxAscSlop
          this.maxDesSlop = desSlop > this.maxDesSlop ? desSlop : this.maxDesSlop
          const breakPoint = ascList.slice(-1)[0]
          const diffHO = breakPoint[HIGH] - breakPoint[LOW]
          const volum = parseFloat(breakPoint[VOLUME])
          res.push([this.convertSlopToStep(ascSlop), {diffHO, volum}])
          reset(current)
        } else {
          reset(current)
        }
      }
      // initial break point for sell
      for(let i = this.minStep; i <= this.maxStep; i++ ) {
        let values = res.filter(v => v[0] == i).map(v=> v[1])
        let point = null
        if(values.length) {
          point = values.reduce((ac, c) => {
            ac.diffHO += c.diffHO
            ac.volum +=  c.volum
            return ac
          })
          point.diffHO /= values.length
          point.volum /= values.length
          this.sellPoints.set(i, point) 
        }
      }
      console.log('update limieters', 'sellPoints', this.sellPoints)
    },
    convertSlopToStep(slop) {
      return Math.round(((slop - this.maxDesSlop) / (this.maxAscSlop - this.maxDesSlop)) * (this.maxStep - this.minStep) + this.minStep)
    },
    selectMarket(event) {
      const value = event.target.value
      if (this.markets[value]) {
        this.selectedMarket = this.markets[value]
      }
    },
    normalize(max, min, value) {
      return (value - min) / (max - min)
    },
    async updateCandle() {
      const res = await acquireKLineData(this.selectedMarket.name, this.selectedTimeFrame, 1)
      const [time, open, close, high, low] = res[0]
      this.candle.item
      this.candle.open = open
      this.candle.close = close
      this.candle.high = high
      this.candle.low = low
      this.candle.isRed = open > close
      this.candle.diffHO = high - low
    },
    async initMarkets() {
      try {
        const res = await getMaketInfo()
        for(const k in res) {
          const market = res[k]
          if (market.pricing_name == 'USDT') {
            this.markets[k] = market
          }  
        }
        this.selectedMarket = this.markets['KAVAUSDT']
      } catch(e) {
        console.log('Occurred wrong in getting the market lists\n',e)
      }
    },
    getAverage(arr, by) {
      return arr.reduce((ac, c)=> ac + Number.parseFloat(c[by]), 0) / arr.length
    },
    getSlop(arr, by = HIGH) {
      const halfIndex = Math.round(arr.length / 2)
      const av1 = this.getAverage(arr.slice(0, halfIndex), by)
      const av2 = this.getAverage(arr.slice(halfIndex, arr.length), by)
      return av1 - av2
    },
    async updateBuySteps() {
      this.availables = []
      const res = await getAccountInfo()
      const assets = res.data.data, maxStep = 8, minStep = 2
      
      if (this.isFirstInit && assets[this.selectedMarket.name]) {
        // TODO: check the history and push order inot the exeStack 
        const history = await getHistory(this.selectedMarket)
      }
      if (assets.USDT) {
        // calculate buy steps
        const slop = await this.getCurrentSlop()
        // convert slop to step
        let stepCount = Math.round(((slop - this.maxDesSlop) / (this.maxAscSlop - this.maxDesSlop)) * 
                        (this.maxStep - this.minStep) + this.minStep)
        // stepCount = stepCount - this.exeStack.length
        this.isChartAsc = slop < 0
        // distributing assets based on the calculated steps
        for (let i = 1; i <= stepCount; i++) {
          const index =  this.isChartAsc ? i : stepCount - i
          const available = assets.USDT.available * ((2 * i) / (stepCount * (stepCount + 1)))
          this.availables.push(available)
        }
      }
      console.log('update the buy steps: ', 'availables', this.availables, 'USDT asset', assets.USDT)
    },
    async getCurrentSlop() {
      const res = await acquireKLineData(this.selectedMarket.name, this.selectedTimeFrame, 10)
      return this.getSlop(res)
    },
    async start() {
      this.isTradingActive = !this.isTradingActive
      if (this.isTradingActive) {
        await this.updateCandle()
        await this.updateLimiters()
        await this.trader()
        this.interval = setInterval( ()=> {
          const date = new Date()
          this.time = date.getUTCHours() + ':' + date.getUTCMinutes() + ':' + date.getUTCSeconds()
          this.updateCandle()
          this.trader()
        }, 10000)
      }
    }
  },
  destroyed() {
    clearInterval(this.interval)
  },
  async mounted() {
    if (this.interval) {
      clearInterval(this.interval)
    }
    await this.initMarkets()
    console.log(this.selectedMarket)
  },
  computed: {
    candleStyle() {
      const {open, close, high, low, diff, isRed} = this.candle
      const c = this.normalize(high, low, close)
      const o = this.normalize(high, low, open)
      const y = isRed ? c : o
      const color = isRed ? 'red' : 'green'
      return `bottom: ${y * 100}%; height: ${Math.abs(o - c) * 100}%; background-color: ${color}`
    }
  }
}
</script>

<style lang="scss">
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
.candle {
  height: 200px;
  position: relative;
  margin: 12px;
}
.line,
.rect {
  position: absolute;
  left: 50%;
  transition: height 0.5s, bottom 0.5s, background-color 1s;
}
.line {
  border-left: 4px solid;
  height: 100%;
  margin-left: -2px;
}
.rect {
  transform: translateX(-50%);
  width: 50%;
}
.fill {
  flex: 1;
  display: inline-grid;
}
.horizontal {
  display: flex;
  flex-direction: row;
  position: relative;
  justify-content: space-between;
}
.vertical {
  display: flex;
  flex-direction: column;
  position: relative;
  justify-content: space-between;
}
.drop-down {
  height: 20px;
}
.settings {
  border-left: 2px solid gray;
  padding-left: 12px;
}
.current-time {
  padding-top: 12px;
  border-top: 2px solid gray;
}
.input-value {
  height: 15px;
  width: 30px;
}
.start-btn {
  height: 40px;
  background: red;
}
.active .start-btn {
  background: green !important;
}
.order-list {
  max-height: 300px;
  overflow: auto;
}
</style>
