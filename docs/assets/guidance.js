/* Transparent suitability rules. Answers stay in this page's memory. */
(function (root) {
  "use strict";
  const A =
    typeof module !== "undefined" && module.exports
      ? require("./analytics.js")
      : root.RealWorthAnalytics;
  const tickers = {
    Bitcoin: "BTC-USD",
    Gold: "GLD",
    "S&P 500": "SPY",
    "T-Bills": "BIL",
    "LT Bonds": "TLT",
  };
  const policies = {
    Bitcoin: { months: 36, stress: 100 },
    Gold: { months: 36, stress: 35 },
    "S&P 500": { months: 60, stress: 40 },
    "T-Bills": { months: 0, stress: 5 },
    "LT Bonds": { months: 60, stress: 40 },
  };
  const validTime = (x) =>
    typeof x === "string" && Number.isFinite(Date.parse(x));
  const dict = {
    en: {
      title: "What is this money for?",
      intro:
        "Tell us what this money must do. We will explain what fits, what does not, and which data supports that view.",
      privacy:
        "Your answers stay on this page. No account, saved profile or AI upload. This is a limited suitability screen, not a complete financial plan.",
      purpose: "1. What kind of money is this?",
      purposeOptions: [
        ["essential", "Rent, tuition, emergency money — I need it back"],
        ["reserve", "Important savings — a loss would delay my plans"],
        ["surplus", "Truly spare money — losing it would not affect my life"],
        ["borrowed", "Borrowed money / money I owe someone"],
      ],
      horizon: "2. When might you need it?",
      horizonOptions: [
        ["0", "Days or weeks"],
        ["3", "Within a few months"],
        ["12", "About a year"],
        ["36", "At least 3 years"],
        ["60", "At least 5 years"],
        ["120", "At least 10 years"],
      ],
      loss: "3. How much could disappear without breaking your plan?",
      lossOptions: [
        ["0", "None — I need the full amount"],
        ["5", "5% — $50 of every $1,000"],
        ["15", "15% — $150 of every $1,000"],
        ["30", "30% — $300 of every $1,000"],
        ["50", "50% — half the money"],
        ["100", "All of it — this is a disposable experiment"],
      ],
      readiness: "4. Are your financial basics covered?",
      readinessOptions: [
        ["ready", "I have an emergency reserve and no expensive debt"],
        ["no-reserve", "I do not have an emergency reserve"],
        ["debt", "I have expensive debt to deal with"],
        ["unknown", "I am not sure"],
      ],
      goal: "5. What do you want this money to do?",
      goalOptions: [
        ["protect", "Stay available and protect the amount"],
        ["income", "Provide steady income"],
        ["growth", "Grow purchasing power over several years"],
        ["quick", "Make quick money from a short-term price move"],
      ],
      currency: "6. What currency will you spend it in?",
      currencyOptions: [
        ["USD", "US dollars (USD)"],
        ["CAD", "Canadian dollars (CAD)"],
        ["other", "Another currency"],
      ],
      amount: "Amount you are considering",
      choose: "Choose an answer",
      submit: "Show my recommendation and evidence",
      changed:
        "Answers changed. Generate a new result before using the previous guidance.",
      result: "What we recommend for this money",
      why: "Why this conclusion?",
      next: "A practical next step",
      evidence: "Check each asset against your needs",
      history: "What actually happened in the shared history",
      data: "Open the underlying data",
      rules: "How the screening rules work",
      protected: "Keep this money out of these market investments.",
      debt: "Do not use this money to speculate. Put essential cash needs and expensive debt first.",
      reserve:
        "Build or clarify your emergency reserve before taking market risk.",
      quick: "Do not use this dashboard as a quick-profit trading system.",
      short:
        "For money needed soon, compare cash-like options before market investments.",
      currencyTitle:
        "Resolve the spending-currency risk before choosing a US-dollar investment.",
      growth:
        "Start by comparing a diversified long-term approach, rather than treating Bitcoin as savings.",
      income:
        "Compare liquidity and variable income; none of these ETFs promises a fixed payout or principal.",
      cautious:
        "Your needs and the available evidence do not support taking more market risk. Keeping the money available is a valid choice.",
      need: "You said this money is essential, borrowed, or cannot lose value. Wanting higher returns does not change that constraint.",
      basics:
        "A missing emergency reserve, expensive debt or an unknown cash position reduces what you can afford to risk.",
      quickWhy:
        "A short-term gain is possible, but reliable quick profit is not established. Price-estimate errors and interval coverage do not prove that a trading strategy earns money after fees, spreads or taxes.",
      shortWhy:
        "A monthly history cannot establish the chance of preserving money over days or weeks. Even low-volatility ETFs can fall; a cash-like ETF is not an insured bank deposit.",
      currencyWhy:
        "The return research uses USD and US CPI. It does not measure your CAD/other-currency purchasing power, exchange costs or local taxes.",
      longWhy:
        "Time and truly spare money make research possible, but do not make an investment safe. Historical losses can be exceeded, and overlapping holding windows are not independent trials.",
      cashNext:
        "Compare locally protected savings/deposits or short government securities matched to your currency, deadline and withdrawal needs. Check eligibility, protection limits and early-exit terms with the provider; this site does not compare those products or their current rates.",
      debtNext:
        "Clarify essential cash needs and the cost of your debt before considering a risky purchase. Do not borrow to chase a price move.",
      reserveNext:
        "Work out what money must stay accessible. If you are unsure, keep this amount outside speculative investments until that is clear.",
      quickNext:
        "Pause a quick-profit order. You can observe the frozen forecasts and compare them with later results without risking essential money. The site has no validated, fee-adjusted timing signal for buying today.",
      longNext:
        "Review the eligible comparisons below, then check fees, taxes, currency and your wider portfolio. No entry price, allocation percentage or guaranteed return is being prescribed.",
      avoid: "Not suitable for the stated need",
      research: "Worth comparing — not a buy-today signal",
      experiment: "Disposable experiment only — not savings",
      unknown: "Cannot assess from the available data",
      reasons: {
        protected:
          "Your essential-money / principal constraint overrides return-seeking.",
        basics: "Financial basics are not yet confirmed.",
        quick:
          "This price tool has not established a profitable short-term trading rule.",
        currency: "Local-currency risk is not assessed here.",
        deadline:
          "Your deadline is shorter than our conservative minimum for this asset.",
        loss: "Your stated loss limit is below the screening stress level.",
        income:
          "This asset is not a reliable source of the steady income you requested.",
        history:
          "Too few matching historical windows to support this comparison.",
        capital:
          "This does not fit keeping your amount available and prioritising capital preservation.",
        eligible:
          "Your answers pass this limited screen; loss and future underperformance remain possible.",
      },
      insufficient:
        "The research dataset is unavailable, incomplete or too old to assess this choice. No asset is being cleared as suitable. Keep essential money protected and retry when dated evidence is available.",
      limited:
        "This screen uses only five assets and self-reported answers. It does not know your full finances, tax position or available local products. It is not a professional suitability assessment.",
      whyCards: "What do these price cards mean for my money?",
      summary:
        "These cards show how far prices have moved over similar past periods. They do not tell you that buying today will make money. Start with your money’s purpose, not the biggest number.",
      cardNames: {
        "BTC-USD":
          "Bitcoin is a highly volatile digital asset. A big quoted price does not mean your whole investment must cost that amount.",
        GLD: "This is one share of a gold fund, not an ounce of gold. Its price can fall too.",
        SPY: "This fund holds large US companies. Diversification reduces single-company exposure, not the possibility of a stock-market loss.",
        BIL: "This fund holds short US Treasury bills. It is steadier than many assets, but it is not a guaranteed bank balance.",
        TLT: "This fund holds long US government bonds. Its share price can fall sharply when interest rates change.",
      },
      plain: "What this means",
      details: "See the numbers and how we checked",
      noSignal:
        "This is a rough planning range, not a reliable reason to buy or sell today.",
      noTest: "There is no usable historical error comparison for this card.",
      equal:
        "The price estimate was about as accurate as simply assuming the price would not change.",
      worse:
        "The price estimate missed by more than simply assuming the price would not change.",
      lower:
        "The estimate was closer in this sample. That is not proof of a profitable trading advantage.",
      coverage:
        "Being inside the displayed outer range is not the same as getting the direction right. Prices can also finish outside it.",
      stale:
        "The snapshot or target is out of date / incomplete. Do not treat it as a fresh entry signal.",
      fit: "For your money",
      beforeFit:
        "Want to know whether this risk fits your money? Answer the money-purpose questions above.",
      oldResearch:
        "Research data is dated; historical comparisons are shown, but do not establish current entry conditions.",
    },
    zh: {
      title: "这笔钱，是用来做什么的？",
      intro:
        "先告诉我们这笔钱承担什么任务，再看哪些风险能承受、哪些选择不合适，以及判断依据。",
      privacy:
        "答案只留在当前页面，不建账户、不保存个人档案，也不发给 AI。这是有限的资金适配检查，不能代替完整财务规划。",
      purpose: "1. 这笔钱是什么钱？",
      purposeOptions: [
        ["essential", "房租、学费、应急金——需要拿回来"],
        ["reserve", "重要储蓄——亏损会推迟我的计划"],
        ["surplus", "真正的闲钱——亏掉也不影响生活"],
        ["borrowed", "借来的钱／需要还给别人的钱"],
      ],
      horizon: "2. 什么时候可能要用？",
      horizonOptions: [
        ["0", "几天或几周内"],
        ["3", "几个月内"],
        ["12", "大约一年后"],
        ["36", "至少三年后"],
        ["60", "至少五年后"],
        ["120", "至少十年后"],
      ],
      loss: "3. 少了多少，会影响你的计划？",
      lossOptions: [
        ["0", "不能少——需要拿回全额"],
        ["5", "5%——每 1,000 元少 50 元"],
        ["15", "15%——每 1,000 元少 150 元"],
        ["30", "30%——每 1,000 元少 300 元"],
        ["50", "50%——可以承受少一半"],
        ["100", "全亏也可以——只是可随意使用的实验资金"],
      ],
      readiness: "4. 基本的资金安排做好了吗？",
      readinessOptions: [
        ["ready", "有应急储备，也没有需要优先处理的高息债务"],
        ["no-reserve", "还没有应急储备"],
        ["debt", "有高息债务需要处理"],
        ["unknown", "还不确定"],
      ],
      goal: "5. 希望它帮你做什么？",
      goalOptions: [
        ["protect", "保持可用，尽量保住这笔金额"],
        ["income", "提供稳定收入"],
        ["growth", "用几年时间增长购买力"],
        ["quick", "靠短期涨跌赚快钱"],
      ],
      currency: "6. 以后主要用什么货币花这笔钱？",
      currencyOptions: [
        ["USD", "美元（USD）"],
        ["CAD", "加元（CAD）"],
        ["other", "其他货币"],
      ],
      amount: "考虑投入的金额",
      choose: "请选择",
      submit: "查看建议和数据依据",
      changed: "答案已改变，请重新生成建议；旧结论不再适用。",
      result: "对这笔钱，我们的建议是",
      why: "为什么这样建议？",
      next: "接下来可以做什么",
      evidence: "逐个检查这些资产是否适合你的用途",
      history: "共同历史区间里，实际发生过什么",
      data: "查看原始派生数据",
      rules: "筛选规则与限制",
      protected: "先把这笔钱留在这些市场投资之外。",
      debt: "不要拿这笔钱投机，先处理必须用钱的地方和高息债务。",
      reserve: "先建立或弄清应急储备，再决定要冒多少市场风险。",
      quick: "不要把这个网站当作短期赚快钱的交易系统。",
      short: "近期要用的钱，先比较现金类安排，再考虑市场投资。",
      currencyTitle: "先弄清花钱货币与美元投资之间的汇率风险。",
      growth: "先研究分散的长期投资方式，不把 Bitcoin 当作储蓄替代品。",
      income: "先比较流动性和收入来源；这些 ETF 都不承诺固定收益或保本。",
      cautious:
        "按你的用途、期限与现有证据，不宜据此加大市场风险。先留住资金也是一种选择。",
      need: "你表示这笔钱涉及必要开支、借款，或不能承受损失。想多赚一些，并不会消除这个限制。",
      basics:
        "没有应急金、有高息债务，或还不了解自己的现金安排，都会降低实际承担风险的能力。",
      quickWhy:
        "短期可能赚钱，也可能亏钱；可靠赚快钱的方法在这里没有得到证明。预测误差小、价格落在区间内，都不等于扣除费用和税后能靠交易获利。",
      shortWhy:
        "月度历史不能证明几天、几周内保住资金的概率。即使波动较低的 ETF 也会下跌，现金类 ETF 也不是受存款保障的银行余额。",
      currencyWhy:
        "研究数据以美元和美国 CPI 为基础，没有计算你以加元或其他货币花钱时的购买力、换汇成本和当地税务影响。",
      longWhy:
        "有较长时间、也有真正闲钱，才有进一步研究的空间。这不代表安全；未来可能比历史更差，重叠持有窗口也不是独立实验。",
      cashNext:
        "比较与你的花钱货币、用钱期限和取款需求相匹配的受保障储蓄／存款或短期政府证券。保障资格、额度和提前取款条件应向当地机构核实；本网站没有比较这些产品的当前利率。",
      debtNext:
        "先弄清必要现金开支和债务成本，再考虑风险投资。不要借钱追逐价格波动。",
      reserveNext:
        "先划出必须随时可用的钱。不确定之前，先不要把这笔金额投入投机资产。",
      quickNext:
        "先暂停以赚快钱为目的的下单。可以观察冻结预测与后续结果，而不动用必要资金。网站目前没有经验证、扣费后可获利的“今天买入”择时信号。",
      longNext:
        "先看下方哪些比较通过了初步筛选，再核对费用、税务、汇率和已有投资。这里不给具体入场价、仓位比例或保证收益。",
      avoid: "不适合你填写的用途",
      research: "可以进一步比较，不等于建议今天买入",
      experiment: "仅限可全损的实验闲钱，不能当储蓄",
      unknown: "现有数据不足，无法判断",
      reasons: {
        protected: "必要资金或保本要求，优先于追求回报。",
        basics: "基本资金安排还没有确认。",
        quick: "价格工具没有证明可靠的短期交易获利方法。",
        currency: "这里没有评估你实际花钱货币的风险。",
        deadline: "用钱时间短于该资产的保守筛选期限。",
        loss: "你能承受的亏损，小于筛选使用的压力情景。",
        income: "它不能可靠满足你要求的稳定收入。",
        history: "相同持有期的历史窗口太少，无法据此支持比较。",
        capital: "这不符合优先保住金额、保持资金可用的目标。",
        eligible: "通过的只是有限筛选，仍可能亏损或跑输。",
      },
      insufficient:
        "研究数据不可用、不完整或过旧，无法完成适配判断；不会把任何资产标为适合。先保护必要资金，等有可靠且带日期的证据后再看。",
      limited:
        "这里只比较五种资产，并依赖你自己填写的答案，不了解你的完整财务、税务或当地可用产品，不能代替专业适当性评估。",
      whyCards: "这些价格卡片，对我的钱有什么意义？",
      summary:
        "卡片展示类似历史时段里价格可能波动的范围，不能证明今天买入会赚钱。先确定钱的用途，再看数字。",
      cardNames: {
        "BTC-USD":
          "Bitcoin 是波动很大的数字资产。页面报价是一枚的价格，并不是说必须买整枚。",
        GLD: "这是黄金基金的一份价格，不是一盎司黄金；黄金基金也可能下跌。",
        SPY: "这个基金持有多家美国大公司。分散了单一公司的风险，但仍会受到整个股市下跌的影响。",
        BIL: "这个基金持有短期美国国债。通常比很多资产平稳，但不是保证不减少的银行余额。",
        TLT: "这个基金持有长期美国国债。发行人是政府，也不代表基金价格稳定；利率变化时仍可能大跌。",
      },
      plain: "这对你意味着什么",
      details: "展开数字和检验方法",
      noSignal: "这只是粗略的波动参考，不是可靠的今天买卖理由。",
      noTest: "这张卡片没有可用的历史误差比较。",
      equal: "过去这段测试里，这个估计和“价格保持不变”的猜法差不多准。",
      worse: "过去这段测试里，这个估计还不如直接假设价格不变。",
      lower: "这段样本里估计误差更小，但还不能证明能靠它交易赚钱。",
      coverage: "落在外层范围内，不等于猜对了涨跌；实际价格也可能跑到范围外。",
      stale: "快照、目标时间已过期，或数据不完整，不能当作新的入场信号。",
      fit: "结合你这笔钱的用途",
      beforeFit: "想知道这类风险是否适合你？先回答上面的资金用途问题。",
      oldResearch:
        "历史研究数据已有时差，展示历史比较不代表已经判断当前适合买入。",
    },
  };
  Object.assign(dict.en, {
    amount: "Total money for this plan (not the purchase amount for one asset)",
    partial: "Compare reduced exposure, not an all-in position",
    conditional: "USD comparison possible; currency assessment still needed",
    observe: "Observe and learn; no validated quick-profit strategy",
    budgetTitle:
      "Some options may fit at a smaller scale. Compare the loss budget first.",
    currencyTitle:
      "There are USD comparisons to research; separately assess the currency you will spend.",
    research: "Purpose and horizon support further research",
    experiment: "Possible disposable-money experiment",
    next: "A practical next step",
    role: "Possible role",
    roles: {
      Bitcoin: "High-risk experiment",
      Gold: "Diversification / gold exposure",
      "S&P 500": "Long-term diversified equity growth",
      "T-Bills": "Short-duration liquidity buffer",
      "LT Bonds": "Long-duration rate exposure",
    },
    budgetNext:
      "Compare the smaller-exposure illustrations below. They assume the remainder is unchanged cash and the stated stress occurs; they are not recommended allocations or loss caps. Then review fees, currency, existing holdings and whether that assumed loss still fits your plans.",
    currencyNext:
      "Use the USD evidence to make a research shortlist, then compare unhedged versus hedged exposure, exchange costs and local purchasing power. Amount-based risk budgets are withheld until the currency effect is assessed.",
    fitTiming: "Long-term fit and short-term timing are different questions",
    timingText:
      "The next-period model has not established a profitable entry rule. That does not make a compatible long-term investment unsuitable. You can research diversification, costs and an investment schedule without claiming to know tomorrow’s best price.",
    noSignal:
      "This next-period range is not an entry-timing rule. Long-term suitability is assessed separately above.",
  });
  Object.assign(dict.zh, {
    amount: "本次计划安排的资金总额（不是单一资产的买入金额）",
    partial: "可降低单项投入后再比较，不宜整笔投入",
    conditional: "可先研究美元资产，仍需补上汇率评估",
    observe: "可以观察学习，但没有可靠的短炒方法",
    budgetTitle: "有些选项可以缩小投入后研究，先看整笔资金的损失预算。",
    currencyTitle: "有可研究的美元资产选项；花钱货币的风险需要另外评估。",
    research: "用途和期限支持进一步研究",
    experiment: "可作为可全损闲钱的实验比较",
    role: "可能承担的任务",
    roles: {
      Bitcoin: "高风险实验",
      Gold: "黄金敞口／分散工具",
      "S&P 500": "长期分散股票增长",
      "T-Bills": "短期限流动性缓冲",
      "LT Bonds": "长期利率敞口",
    },
    budgetNext:
      "先比较下方降低单项投入后的数学演示。它假设其余资金是不变的现金、资产发生所列压力跌幅，不是推荐仓位或最大损失保证。再核对费用、汇率、已有持仓和这类损失是否仍不影响计划。",
    currencyNext:
      "先用美元历史列出研究清单，再单独比较未对冲／对冲敞口、换汇成本和本地购买力。汇率影响没有评估之前，不给本地货币的金额风险预算。",
    fitTiming: "长期是否适配，与短线什么时候买，是两个问题",
    timingText:
      "次日模型没有证明可靠的交易买点，但这不等于符合用途和期限的长期投资不适合。可以继续研究分散、费用和投入节奏，而不声称知道明天的最佳价格。",
    noSignal:
      "这张次日区间卡片不能提供可靠买点；长期是否适配，要单独看上方的资金用途筛选。",
  });
  Object.assign(dict.en.reasons, {
    budget:
      "The all-in exposure exceeds your loss limit; a reduced-exposure scenario can be researched.",
    quick:
      "The quick-profit strategy is unsupported; that is different from saying the asset can never serve a longer-term role.",
  });
  Object.assign(dict.zh.reasons, {
    budget: "整笔投入超出你的损失限度，可以研究降低单项敞口的演示。",
    quick: "缺少依据的是可靠赚快钱的方法，并不是说这种资产永远没有长期用途。",
  });
  function exposureScenario(amount, lossPercent, stressPercent) {
    if (
      ![amount, lossPercent, stressPercent].every(Number.isFinite) ||
      amount <= 0 ||
      lossPercent <= 0 ||
      lossPercent > 100 ||
      stressPercent <= 0 ||
      stressPercent > 100
    )
      return null;
    const fraction = Math.min(1, lossPercent / stressPercent),
      riskAmount = amount * fraction;
    return {
      fraction,
      riskAmount,
      cashAmount: amount - riskAmount,
      stressLoss: (riskAmount * stressPercent) / 100,
      stressPercent,
      lossPercent,
    };
  }
  function validateProfile(p) {
    for (const key of [
      "purpose",
      "horizon",
      "loss",
      "readiness",
      "goal",
      "currency",
    ]) {
      const allowed = dict.en[key + "Options"].map((x) => x[0]);
      if (!allowed.includes(String(p[key])))
        throw Error("Complete each money-purpose question.");
    }
    if (
      !Number.isFinite(Number(p.amount)) ||
      Number(p.amount) < 1 ||
      Number(p.amount) > 1e9
    )
      throw Error("Enter an amount from 1 to 1,000,000,000.");
    return {
      ...p,
      horizon: Number(p.horizon),
      loss: Number(p.loss),
      amount: Number(p.amount),
    };
  }
  function validateHistory(d, now) {
    if (
      !A ||
      !Array.isArray(d?.meta?.assets) ||
      d.meta.assets.length !== 5 ||
      !d.meta.assets.every((a) => Object.hasOwn(tickers, a)) ||
      new Set(d.meta.assets).size !== 5 ||
      !validTime(d.meta.last_updated) ||
      !Array.isArray(d.growth?.dates) ||
      d.growth.dates.length < 13
    )
      throw Error("Invalid research evidence");
    const dates = d.growth.dates;
    dates.forEach((v, i) => {
      if (
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(v) ||
        (i &&
          Date.parse(v + "-01") !==
            Date.UTC(
              Number(dates[i - 1].slice(0, 4)),
              Number(dates[i - 1].slice(5, 7)),
              1,
            ))
      )
        throw Error("Invalid monthly evidence dates");
    });
    for (const kind of ["real", "nominal"])
      for (const a of d.meta.assets) {
        const v = d.growth[kind]?.[a];
        if (
          !Array.isArray(v) ||
          v.length !== dates.length ||
          v.some((x) => x !== null && (!Number.isFinite(x) || x <= 0))
        )
          throw Error("Invalid growth evidence");
      }
    if (
      d.meta.data_through !== dates.at(-1) ||
      now - Date.parse(d.meta.last_updated) > 75 * 864e5 ||
      now - Date.parse(dates.at(-1) + "-01") > 110 * 864e5 ||
      Date.parse(d.meta.last_updated) > now + 864e5
    )
      throw Error("Research evidence is too old or future-dated");
    const b = A.bounds(d);
    if (b.start < 0 || b.end - b.start < 12)
      throw Error("Too little common evidence");
    return b;
  }
  function nominalDrawdown(path, start, end) {
    let peak = path[start],
      dd = 0;
    for (let i = start; i <= end; i++)
      if (Number.isFinite(path[i])) {
        peak = Math.max(peak, path[i]);
        dd = Math.min(dd, 100 * (path[i] / peak - 1));
      }
    return dd;
  }
  function assessForecast(row, now = Date.now()) {
    const b = row?.forecast?.backtest;
    const valid =
      b &&
      Number.isFinite(b.mean_abs_price_error_percent) &&
      b.mean_abs_price_error_percent >= 0 &&
      Number.isFinite(b.random_walk_error_percent) &&
      b.random_walk_error_percent >= 0 &&
      Number.isInteger(b.observations) &&
      b.observations > 0;
    let comparison = "unknown";
    if (valid) {
      const model = Number(b.mean_abs_price_error_percent.toFixed(2)),
        base = Number(b.random_walk_error_percent.toFixed(2));
      comparison = model > base ? "worse" : model < base ? "lower" : "equal";
    }
    const stale =
      !row ||
      row.quote_stale ||
      !Number.isFinite(row.quote) ||
      row.quote <= 0 ||
      !validTime(row.quote_at) ||
      now - Date.parse(row.quote_at) > 4 * 864e5 ||
      !validTime(row.forecast?.target_at) ||
      Date.parse(row.forecast.target_at) <= now;
    return {
      comparison,
      valid,
      stale,
      model: valid ? b.mean_abs_price_error_percent : null,
      baseline: valid ? b.random_walk_error_percent : null,
      n: valid ? b.observations : null,
      coverage: Number.isFinite(b?.coverage_percent)
        ? b.coverage_percent
        : null,
      entrySignal: false,
    };
  }
  function investmentIllustration(row, amount = 1000) {
    const f = row?.forecast;
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isFinite(f?.anchor_price) ||
      f.anchor_price <= 0 ||
      ![f.levels?.q10, f.levels?.q90].every(
        (n) => Number.isFinite(n) && n > 0,
      ) ||
      f.levels.q10 > f.levels.q90
    )
      return null;
    return {
      lower: (amount * f.levels.q10) / f.anchor_price,
      upper: (amount * f.levels.q90) / f.anchor_price,
      amount,
    };
  }
  function evaluate(
    profile,
    data,
    forecasts,
    now = Date.now(),
    research = null,
  ) {
    const p = validateProfile(profile);
    let bounds;
    try {
      bounds = validateHistory(data, now);
    } catch (e) {
      return { profile: p, action: "unavailable", rows: [], unavailable: true };
    }
    const protectedMoney =
      ["essential", "borrowed"].includes(p.purpose) || p.loss === 0;
    const basics = p.readiness !== "ready";
    let action = protectedMoney
      ? p.purpose === "borrowed"
        ? "debt"
        : "protected"
      : basics
        ? p.readiness === "debt"
          ? "debt"
          : "reserve"
        : p.goal === "quick"
          ? "quick"
          : p.horizon <= 12
            ? "short"
            : p.goal === "protect"
              ? "cautious"
              : p.goal === "income"
                ? "income"
                : "growth";
    const matching = p.horizon >= 12 ? p.horizon : 12;
    const rows = data.meta.assets.map((asset) => {
      const policy = policies[asset],
        nominalDD = nominalDrawdown(
          data.growth.nominal[asset],
          bounds.start,
          bounds.end,
        ),
        real = A.score(data, asset, bounds.start, bounds.end),
        rolling = A.rolling(data, asset, matching, true);
      const stress = Math.max(policy.stress, Math.abs(nominalDD));
      let reason = protectedMoney
        ? "protected"
        : basics
          ? "basics"
          : p.goal === "quick"
            ? "quick"
            : p.horizon < policy.months
              ? "deadline"
              : p.goal === "protect" && asset !== "T-Bills"
                ? "capital"
                : p.goal === "income" && asset !== "T-Bills"
                  ? "income"
                  : rolling.n < 12
                    ? "history"
                    : asset === "Bitcoin" && p.purpose !== "surplus"
                      ? "protected"
                      : p.loss < stress
                        ? "budget"
                        : "eligible";
      let baseStatus =
        reason === "eligible"
          ? asset === "Bitcoin"
            ? "experiment"
            : "research"
          : reason === "budget"
            ? "partial"
            : reason === "quick"
              ? "observe"
              : reason === "history"
                ? "unknown"
                : "avoid";
      const currencyUnassessed = p.currency !== "USD";
      const status =
        currencyUnassessed &&
        ["research", "partial", "experiment"].includes(baseStatus)
          ? "conditional"
          : baseStatus;
      const scenario =
        baseStatus === "partial" && !currencyUnassessed
          ? exposureScenario(p.amount, p.loss, stress)
          : null;
      const f = forecasts?.assets?.find((r) => r.ticker === tickers[asset]);
      return {
        asset,
        ticker: tickers[asset],
        status,
        reason,
        baseStatus,
        currencyUnassessed,
        scenario,
        nominalDD,
        realDD: real.max_drawdown,
        annReal: real.ann_real_return,
        rolling,
        matching,
        matchedToDeadline: p.horizon >= 12,
        stress,
        policy,
        market: assessForecast(f, now),
      };
    });
    const candidates = rows.filter((r) =>
      ["research", "partial", "conditional", "experiment"].includes(r.status),
    );
    if (action === "growth") {
      if (!candidates.length) action = "cautious";
      else if (rows.some((r) => r.baseStatus === "partial"))
        action = "budgetTitle";
    }
    if (
      p.currency !== "USD" &&
      candidates.length &&
      !protectedMoney &&
      !basics &&
      p.goal !== "quick" &&
      ["growth", "budgetTitle", "income"].includes(action)
    )
      action = "currencyTitle";
    return {
      profile: p,
      action,
      rows,
      bounds,
      start: data.growth.dates[bounds.start],
      end: data.growth.dates[bounds.end],
      updated: data.meta.last_updated,
      unavailable: false,
      forecastChecked: forecasts?.meta?.checked_at || null,
      macro: {
        fresh:
          !!research?.macro &&
          validTime(research.macro.checked_at) &&
          now - Date.parse(research.macro.checked_at) <= 48 * 36e5 &&
          Date.parse(research.macro.checked_at) <= now + 6e5 &&
          !research.macro.stale,
        checked: research?.macro?.checked_at || null,
        growth: research?.macro?.growth_direction || "Unknown",
        inflation: research?.macro?.inflation_direction || "Unknown",
        pressure: Array.isArray(research?.macro?.pressure_flags)
          ? research.macro.pressure_flags
          : [],
      },
      forecastsStale:
        !validTime(forecasts?.meta?.checked_at) ||
        now - Date.parse(forecasts.meta.checked_at) > 45 * 6e4,
    };
  }
  const api = {
    evaluate,
    assessForecast,
    investmentIllustration,
    exposureScenario,
    validateProfile,
    policies,
    dict,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.RealWorthGuidance = api;
  if (typeof document === "undefined") return;
  const make = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const pct = (n) => (Number.isFinite(n) ? n.toFixed(2) + "%" : "—");
  let lang = navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en",
    state = null,
    history = null,
    forecasts = null,
    busy = false;
  const t = () => dict[lang];
  const label = (asset) =>
    lang === "zh"
      ? {
          Bitcoin: "Bitcoin／比特币",
          Gold: "黄金基金 GLD",
          "S&P 500": "美股基金 SPY",
          "T-Bills": "短债基金 BIL",
          "LT Bonds": "长债基金 TLT",
        }[asset] || asset
      : asset;
  function languageChange(next) {
    lang = next === "zh" ? "zh" : "en";
    document
      .querySelectorAll("[data-guide-language]")
      .forEach((s) => (s.value = lang));
    renderForm(true);
    renderResult();
    api.updateIntro();
    document.dispatchEvent(new Event("realworth:guidance-changed"));
  }
  function renderForm(preserve = false) {
    const mount = document.getElementById("money-form-root");
    if (!mount) return;
    const previous = preserve ? readForm() : null,
      d = t();
    mount.replaceChildren();
    document.getElementById("money-title").textContent = d.title;
    document.getElementById("money-intro").textContent = d.intro;
    document.getElementById("money-privacy").textContent = d.privacy;
    const form = make("form");
    form.id = "money-form";
    const grid = make("div", undefined, "money-questions");
    for (const key of [
      "purpose",
      "horizon",
      "loss",
      "readiness",
      "goal",
      "currency",
    ]) {
      const wrapper = make("label", d[key]),
        select = make("select");
      select.name = key;
      select.id = "money-" + key;
      select.required = true;
      const empty = make("option", d.choose);
      empty.value = "";
      empty.disabled = true;
      empty.selected = true;
      select.append(empty);
      for (const [value, text] of d[key + "Options"]) {
        const option = make("option", text);
        option.value = value;
        select.append(option);
      }
      if (previous && previous[key] !== undefined) select.value = previous[key];
      wrapper.append(select);
      grid.append(wrapper);
    }
    const amount = make("label", d.amount),
      input = make("input");
    input.id = "money-amount";
    input.type = "number";
    input.name = "amount";
    input.min = "1";
    input.max = "1000000000";
    input.step = "any";
    input.required = true;
    input.inputMode = "decimal";
    input.value = previous?.amount || "1000";
    amount.append(input);
    grid.append(amount);
    form.append(grid);
    const submit = make("button", d.submit, "button");
    submit.type = "submit";
    submit.disabled = busy;
    form.append(submit);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      generate();
    });
    form.addEventListener("input", () => {
      if (state) {
        state = null;
        document.getElementById("money-result").hidden = true;
        document.getElementById("money-status").textContent = d.changed;
        document.dispatchEvent(new Event("realworth:guidance-changed"));
      }
    });
    mount.append(form);
  }
  function readForm() {
    const form = document.getElementById("money-form");
    return form ? Object.fromEntries(new FormData(form)) : null;
  }
  function evidenceRow(r) {
    const d = t(),
      box = make(
        "article",
        undefined,
        "money-asset " +
          (r.status === "research" ? "money-compare" : "money-" + r.status),
      );
    box.dataset.asset = r.asset;
    box.dataset.status = r.status;
    box.append(
      make("h4", label(r.asset)),
      make("p", d[r.status], "fit-label"),
      make("p", d.reasons[r.reason]),
    );
    box.append(make("p", `${d.role}: ${d.roles[r.asset]}`, "tiny"));
    if (r.scenario) {
      const x = r.scenario,
        f = (n) =>
          "$" + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
      box.append(
        make(
          "p",
          lang === "zh"
            ? `数学演示：总额 ${f(state.profile.amount)}，若资产下跌 ${pct(x.stressPercent)}，风险部分 ${f(x.riskAmount)}、其余 ${f(x.cashAmount)} 假设不变时，损失约 ${f(x.stressLoss)}，相当于总额 ${x.lossPercent}%。这不是推荐仓位；跌幅更大、费用或汇率变化仍可能超出预算。`
            : `Arithmetic illustration: from ${f(state.profile.amount)}, ${f(x.riskAmount)} exposed to a ${pct(x.stressPercent)} fall and ${f(x.cashAmount)} assumed unchanged would lose about ${f(x.stressLoss)} (${x.lossPercent}% of the total). This is not a recommended allocation; a larger fall, costs or FX can exceed it.`,
          "budget-illustration",
        ),
      );
    }
    if (r.currencyUnassessed) box.append(make("p", d.currencyWhy, "tiny"));
    const detailed = make("details"),
      summary = make(
        "summary",
        lang === "zh" ? "为什么？查看数据依据" : "Why? See the evidence",
      );
    detailed.append(summary);
    const lines =
      lang === "zh"
        ? [
            `同一起止月：${state.start} 至 ${state.end}，数据更新 ${state.updated}。`,
            `月末观察到的最大名义回撤 ${pct(r.nominalDD)}；扣通胀后的最大回撤 ${pct(r.realDD)}。这两者口径不同，月中可能跌得更深。`,
            `${r.matching / 12} 年持有窗口 ${r.rolling.n} 个，因缺少端点而遗漏 ${r.rolling.skipped} 个。历史跑赢通胀比例 ${pct(r.rolling.beat)}，最差到期实际回报 ${pct(r.rolling.min)}。${r.matchedToDeadline ? "" : "这是一年背景资料，不是你几天／几个月期限的结果。"}`,
            `你的亏损限度 ${pLoss()}%；保守筛选使用 ${pct(r.stress)} 的名义损失压力情景。${r.asset === "Bitcoin" ? "Bitcoin 只允许可全损的真正闲钱进入实验比较。" : "压力情景至少为 " + r.policy.stress + "%，也不能小于本样本名义最大回撤。"}这些是公开的筛选假设，不是预测，也不是最大可能损失。`,
            `下一步价格估计：${forecastWords(r.market)} 这不是已验证的交易收益证据。`,
          ]
        : [
            `Same endpoints: ${state.start} to ${state.end}; data updated ${state.updated}.`,
            `Observed month-end nominal drawdown ${pct(r.nominalDD)}; real drawdown ${pct(r.realDD)}. These measure different losses; intra-month falls can be worse.`,
            `${r.matching / 12}-year windows: ${r.rolling.n}, with ${r.rolling.skipped} missing endpoints omitted. Historical inflation-beating share ${pct(r.rolling.beat)}; worst final real return ${pct(r.rolling.min)}. ${r.matchedToDeadline ? "" : "This is one-year context, not a result for your days/months deadline."}`,
            `Your loss limit: ${pLoss()}%; screening stress: ${pct(r.stress)} nominal loss. The policy floor is ${r.policy.stress}%, and never below the observed nominal drawdown. Bitcoin requires disposable money that can be lost entirely. These are disclosed screening assumptions, not predictions or maximum possible losses.`,
            `Next-period estimate: ${forecastWords(r.market)} This is not evidence of trading profitability.`,
          ];
    for (const line of lines) detailed.append(make("p", line, "tiny"));
    if (state.profile.currency === "USD")
      detailed.append(
        make(
          "p",
          lang === "zh"
            ? `以你填写的 $${state.profile.amount.toLocaleString()} 示意，同等名义跌幅会减少约 $${((state.profile.amount * Math.abs(r.nominalDD)) / 100).toFixed(0)}；这是历史跌幅的金额缩放，不是未来亏损估计。`
            : `For your $${state.profile.amount.toLocaleString()}, the same historical nominal decline would reduce value by about $${((state.profile.amount * Math.abs(r.nominalDD)) / 100).toFixed(0)}. This scales a past decline, not a future loss estimate.`,
          "tiny",
        ),
      );
    detailed.append(
      make(
        "p",
        lang === "zh"
          ? `本区间年化实际增长 ${pct(r.annReal)}。这不是承诺收益；若为负，表示这段样本里购买力在减少。`
          : `Annualised real growth over this sample: ${pct(r.annReal)}. This is not an expected future return; a negative value means purchasing power eroded in this sample.`,
        "tiny",
      ),
    );
    const readable = make(
      "a",
      lang === "zh"
        ? "查看可读的历史比较表 → "
        : "Open the historical comparison tables → ",
    );
    readable.href = "research.html#scorecard";
    detailed.append(readable);
    const source = make("a", d.data);
    source.href = "data/data.json";
    detailed.append(source);
    box.append(detailed);
    return box;
  }
  function pLoss() {
    return state.profile.loss;
  }
  function forecastWords(m) {
    if (!m.valid) return t().noTest;
    return (
      (lang === "zh"
        ? `平均误差 ${pct(m.model)}，价格不变猜法 ${pct(m.baseline)}，${m.n} 次历史检验。`
        : `Average miss ${pct(m.model)} versus ${pct(m.baseline)} for unchanged prices, across ${m.n} historical checks. `) +
      t()[m.comparison]
    );
  }
  function renderResult() {
    const mount = document.getElementById("money-result");
    if (!mount) return;
    if (!state) {
      mount.hidden = true;
      return;
    }
    mount.hidden = false;
    mount.replaceChildren();
    const d = t();
    mount.append(make("p", d.result, "eyebrow"));
    if (state.unavailable) {
      mount.append(make("h3", d.insufficient));
      return;
    }
    mount.append(make("h3", d[state.action]));
    const selected = [
      "purpose",
      "horizon",
      "loss",
      "readiness",
      "goal",
      "currency",
    ].map(
      (key) =>
        d[key + "Options"].find((o) => o[0] === String(state.profile[key]))[1],
    );
    mount.append(make("p", selected.join(" · "), "tiny"));
    const why = make("div", undefined, "money-reasons");
    why.append(make("h4", d.why));
    const reasons = [];
    if (
      ["essential", "borrowed"].includes(state.profile.purpose) ||
      state.profile.loss === 0
    )
      reasons.push(d.need);
    if (state.profile.readiness !== "ready") reasons.push(d.basics);
    if (state.profile.goal === "quick") reasons.push(d.quickWhy);
    if (state.profile.horizon <= 12) reasons.push(d.shortWhy);
    if (state.profile.currency !== "USD") reasons.push(d.currencyWhy);
    if (!reasons.length) reasons.push(d.longWhy);
    for (const text of reasons) why.append(make("p", text));
    mount.append(why);
    let next = ["protected", "short", "cautious"].includes(state.action)
      ? d.cashNext
      : state.action === "debt"
        ? d.debtNext
        : state.action === "reserve"
          ? d.reserveNext
          : state.action === "quick"
            ? d.quickNext
            : state.action === "currencyTitle"
              ? d.cashNext
              : d.longNext;
    if (state.action === "budgetTitle") next = d.budgetNext;
    if (state.action === "currencyTitle") next = d.currencyNext;
    mount.append(make("h4", d.next), make("p", next));
    const choices = state.rows.filter((r) =>
      ["research", "partial", "conditional", "experiment"].includes(r.status),
    );
    if (choices.length)
      mount.append(
        make(
          "p",
          (lang === "zh"
            ? "可继续研究的选项（不代表推荐顺序）："
            : "Research options (not a return ranking): ") +
            choices.map((r) => label(r.asset)).join(" · "),
          "research-shortlist",
        ),
      );
    if (state.forecastsStale)
      mount.append(
        make(
          "p",
          lang === "zh"
            ? "当前报价快照不够新或无法取得；不能据此判断现在是否适合入场。"
            : "The quote snapshot is stale or unavailable; it cannot establish current entry conditions.",
          "notice",
        ),
      );
    const current = make("div", undefined, "money-current");
    current.append(make("h4", d.fitTiming));
    current.append(make("p", d.timingText));
    const m = state.macro;
    if (m?.fresh) {
      const text =
        m.growth === "Falling" && m.inflation === "Rising"
          ? lang === "zh"
            ? "宏观面板显示增长放慢、通胀上升：政策取舍更难，不能把它当成短线机会。"
            : "The macro panel shows slowing growth and rising inflation: a harder policy trade-off, not a short-term opportunity signal."
          : lang === "zh"
            ? "宏观面板可作背景，但没有经过验证的择时能力。"
            : "The macro panel supplies context, not a validated entry-timing model.";
      current.append(make("p", text));
      if (m.pressure.length)
        current.append(
          make(
            "p",
            lang === "zh"
              ? "面板还标记了信用或就业压力，先调查风险，不把压力当作抄底理由。"
              : "The panel also flags credit or employment pressure. Investigate the risk rather than treating stress as a reason to buy.",
          ),
        );
      current.append(
        make(
          "p",
          (lang === "zh" ? "宏观快照检查时间：" : "Macro snapshot checked: ") +
            m.checked,
          "tiny",
        ),
      );
    } else
      current.append(
        make(
          "p",
          lang === "zh"
            ? "当前宏观数据缺失或过期，不能据此断言现在适合买入。"
            : "Current macro evidence is missing or stale; it cannot establish that now is a good entry time.",
          "tiny",
        ),
      );
    const macroLink = make(
      "a",
      lang === "zh" ? "查看经济环境证据" : "Inspect the economic evidence",
    );
    macroLink.href = "research.html#weather";
    current.append(macroLink);
    mount.append(current);
    mount.append(make("h4", d.evidence));
    if (state.rows.some((r) => r.scenario))
      mount.append(
        make(
          "p",
          lang === "zh"
            ? "每张卡片是独立的“单一资产＋其余资金不变”替代情景，不能把多张卡片的投入金额叠加。若同时持有多项风险资产，需要重新评估总损失与相关性。"
            : "Each card is an alternative single-asset-plus-unchanged-cash scenario. Do not add their amounts together. Multiple simultaneous exposures require a new assessment of combined loss and correlation.",
          "notice",
        ),
      );
    const grid = make("div", undefined, "money-evidence-grid");
    for (const row of state.rows) grid.append(evidenceRow(row));
    mount.append(grid);
    const rules = make("details");
    rules.append(
      make("summary", d.rules),
      make(
        "p",
        lang === "zh"
          ? "先检查必要资金、借款、零亏损和基本资金安排，再检查短线目的、货币、期限、压力情景和历史样本。不能因为愿意冒险，就忽略实际上承担不起风险。SPY/TLT 最少五年，黄金和 Bitcoin 最少三年；这些保守期限与压力数值是筛选规则，不保证持有到期不亏。重叠窗口比例不是未来概率，也不证明当前价格便宜。"
          : "The screen checks essential/borrowed money, zero-loss needs and financial basics before goals, currency, horizon, stress and sample size. Willingness does not override capacity. Policy minima: five years for SPY/TLT; three for gold/Bitcoin. These conservative horizons and stress amounts do not guarantee recovery. Overlapping window proportions are not future probabilities or evidence that today’s price is cheap.",
      ),
      make("p", d.limited, "tiny"),
    );
    mount.append(rules);
  }
  async function read(url) {
    const r = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw Error("HTTP " + r.status);
    return r.json();
  }
  async function generate() {
    const status = document.getElementById("money-status");
    busy = true;
    document.querySelector("#money-form button").disabled = true;
    status.textContent =
      lang === "zh"
        ? "正在读取带日期的研究与价格数据……"
        : "Reading dated research and price evidence…";
    const answers = readForm();
    try {
      const results = await Promise.allSettled([
        read("data/data.json"),
        read("data/forecasts.json"),
        read("data/research.json"),
      ]);
      if (JSON.stringify(readForm()) !== JSON.stringify(answers)) {
        state = null;
        renderResult();
        status.textContent = t().changed;
        return;
      }
      history = results[0].status === "fulfilled" ? results[0].value : null;
      forecasts = results[1].status === "fulfilled" ? results[1].value : null;
      state = evaluate(
        answers,
        history,
        forecasts,
        Date.now(),
        results[2].status === "fulfilled" ? results[2].value : null,
      );
      renderResult();
      status.textContent = state.unavailable
        ? t().insufficient
        : lang === "zh"
          ? "结果已生成。先看结论，再展开每张资产卡片的数据依据。"
          : "Ready. Read the conclusion, then open each asset’s evidence.";
      document.dispatchEvent(new Event("realworth:guidance-changed"));
    } catch (e) {
      state = null;
      renderResult();
      status.textContent =
        lang === "zh"
          ? "无法完成检查，请确认问题已填全且金额有效。没有生成适合买入的结论。"
          : "Could not complete this check. Confirm every answer and amount; no asset has been cleared for purchase.";
    } finally {
      busy = false;
      document.querySelector("#money-form button").disabled = false;
    }
  }
  function appendCardGuide(row, card, meta, live) {
    const d = t(),
      m = assessForecast(row),
      box = make("div", undefined, "card-explanation");
    if (
      !validTime(meta?.checked_at) ||
      Date.now() - Date.parse(meta.checked_at) > 45 * 6e4 ||
      Date.parse(meta.checked_at) > Date.now() + 6e5
    )
      m.stale = true;
    const oldSnapshot =
      !validTime(meta?.checked_at) ||
      Date.now() - Date.parse(meta.checked_at) > 45 * 6e4 ||
      Date.parse(meta.checked_at) > Date.now() + 6e5;
    const staleText = oldSnapshot
      ? lang === "zh"
        ? "报价快照不是足够新的当前观察；先检查更新时间，不把它当作入场信号。"
        : "The quote snapshot is not a sufficiently fresh current observation. Check its update time before considering an entry."
      : validTime(row.forecast?.target_at) &&
          Date.parse(row.forecast.target_at) <= Date.now()
        ? lang === "zh"
          ? "这次情景的目标时间已经过去；应先看后续核验，不当作新预测。"
          : "This scenario’s target has passed. Read the outcome check rather than treating it as a new prediction."
        : d.stale;
    box.append(
      make("h4", d.plain),
      make("p", m.stale ? staleText : m.valid ? d[m.comparison] : d.noTest),
    );
    const proof = make("details");
    proof.className = "card-test-evidence";
    proof.append(
      make(
        "summary",
        lang === "zh"
          ? "为什么这样说？看检验记录"
          : "Why? See the test evidence",
      ),
      make("p", forecastWords(m), "tiny"),
      make("p", d.noSignal, "tiny"),
      make("p", d.coverage, "tiny"),
    );
    if (live)
      proof.append(
        make(
          "p",
          lang === "zh"
            ? `公开发布后的记录：${live.dates} 个不同目标日期，外层范围覆盖 ${pct(live.coverage)}。这不是赚钱比例，也不是猜对涨跌的比例。`
            : `Published checks: ${live.dates} distinct target dates; ${pct(live.coverage)} inside the outer range. This is not the share of profitable trades or correct directions.`,
          "tiny",
        ),
      );
    else
      proof.append(
        make(
          "p",
          lang === "zh"
            ? "尚未读到这项资产的发布后核验结果。"
            : "Post-publication checks are not available for this card.",
          "tiny",
        ),
      );
    box.append(proof);
    if (!state || state.profile.currency === "USD") {
      const amount = state?.profile?.amount || 1000,
        example = investmentIllustration(row, amount);
      if (example) {
        const exampleBox = make("details"),
          format = (n) => "$" + Math.round(n).toLocaleString();
        exampleBox.append(
          make(
            "summary",
            lang === "zh"
              ? "换成一笔钱，会是多少？"
              : "What would that mean for an amount of money?",
          ),
          make(
            "p",
            lang === "zh"
              ? `只为理解数字：假设在冻结起点价格投入 ${format(amount)}，外层范围对应约 ${format(example.lower)} 至 ${format(example.upper)}。这不是从今天报价买入后的回报预测，未计费用和税，实际也可能超出范围。`
              : `For illustration only: ${format(amount)} invested at the frozen starting quote would scale the outer range to about ${format(example.lower)}–${format(example.upper)}. This is not a return forecast for buying at today’s quote, excludes costs/taxes, and outcomes can lie outside it.`,
            "tiny",
          ),
        );
        box.append(exampleBox);
      }
    }
    const fit = state?.rows?.find((r) => r.ticker === row.ticker);
    box.append(
      make(
        "p",
        fit
          ? `${d.fit}: ${d[fit.status]} — ${d.reasons[fit.reason]}`
          : state?.unavailable
            ? d.insufficient
            : d.beforeFit,
        "card-fit",
      ),
    );
    const link = make(
      "a",
      lang === "zh" ? "回到资金用途检查 ↑" : "Check my money’s purpose ↑",
    );
    link.href = "#money-plan";
    box.append(link);
    card.append(box);
  }
  api.appendCardGuide = appendCardGuide;
  api.assetDescription = (ticker) => t().cardNames[ticker];
  api.language = () => lang;
  api.snapshot = () => state;
  api.updateIntro = () => {
    const h = document.getElementById("forecast-guide-title"),
      p = document.getElementById("forecast-guide-summary");
    if (h) h.textContent = t().whyCards;
    if (p) p.textContent = t().summary;
  };
  api.updateIntro();
  document.querySelectorAll("[data-guide-language]").forEach((select) => {
    select.value = lang;
    select.addEventListener("change", () => languageChange(select.value));
  });
  renderForm();
})(globalThis);
