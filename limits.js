// 免費版與 Pro 的額度。主程序與畫面端共用這一份。
// 這是公開原始碼的本機 app,額度是體驗上的牆,不是防破解的機制。
const PLAN_LIMITS = {
  free: { elements: 5, templates: 1, groups: 1, boards: 1 },
  pro: { elements: Infinity, templates: 6, groups: 7, boards: Infinity }
}

function limitsFor(plan) {
  return plan === 'pro' ? PLAN_LIMITS.pro : PLAN_LIMITS.free
}

function canAdd(plan, kind, currentCount) {
  return currentCount < limitsFor(plan)[kind]
}

// 覆寫自己已經有內容的那一組不算新增;清空過的組不佔額度
function canSaveGroup(plan, groups, slot) {
  const others = Object.entries(groups).filter(([key, ids]) => key !== String(slot) && ids.length > 0)
  return others.length < limitsFor(plan).groups
}

if (typeof module !== 'undefined') {
  module.exports = { PLAN_LIMITS, limitsFor, canAdd, canSaveGroup }
}
