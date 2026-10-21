import { test, expect } from "@playwright/test";
import { PAYMENT_NETWORKS } from "../shared/payment-networks";
import { TRON_PAYMENT } from "../shared/tron-payment";
const payer = `0x${"34".repeat(20)}`, recipient = "0xBedc9b4709b5c9759aeCDcD542BF91c9C2aD7340";
const txHash = `0x${"ab".repeat(32)}`;
const id = "ef".repeat(32);
async function setup(page: any, feeChanges = false) {
  let binding: any = null, paid = false, estimates = 0;
  const calls: any[] = [];
  const networks = Object.values(PAYMENT_NETWORKS).map(n => ({ ...n, protocol: "evm", recipient, data: `0xa9059cbb${recipient.slice(2).toLowerCase().padStart(64,"0")}${BigInt("25"+"0".repeat(n.decimals)).toString(16).padStart(64,"0")}${id}` }));
  await page.addInitScript(({payer,txHash}:any) => {
    localStorage.setItem("visitor-privacy-choice-v1", "necessary"); localStorage.setItem("public-locale", "ru");
    let chain = "0xa86a"; (window as any).walletCalls = [];
    (window as any).ethereum = { isMetaMask: true, request: async (r:any) => {
      (window as any).walletCalls.push(r);
      if (r.method === "eth_requestAccounts" || r.method === "eth_accounts") return [payer];
      if (r.method === "eth_chainId") return chain;
      if (r.method === "wallet_switchEthereumChain") { chain = r.params[0].chainId; return null; }
      if (r.method === "personal_sign") return "0x"+"aa".repeat(65);
      if (r.method === "eth_sendTransaction") return txHash;
      return null;
    }};
  }, {payer,txHash});
  await page.route("**/api/direct-payment/**", async (route:any) => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const body = request.method() === "POST" ? request.postDataJSON() : {};
    calls.push({path,body});
    if (path.endsWith("/estimate")) {
      estimates++;
      const quote = networks.filter(n => !body.onlySelected || n.id === body.network).map(n => ({ network: n.id, status: feeChanges && estimates > 1 ? "insufficient_gas" : "ready", tokenBalance:"50",nativeBalance:"1",estimatedNative:"0.0001",budgetNative:"0.0002",estimatedUsd: n.id === "polygon" ? .005 : n.id === "bnb" ? .01 : n.id === "avalanche" ? .05 : 2,gasLimit:"0x10000",quotedAt:Date.now() }));
      return route.fulfill({json:{estimates:quote,recommended:"polygon"}});
    }
    if (path.endsWith("/challenge")) return route.fulfill({json:{message:"Confirm this test order; no spending permission.",challengeToken:"test-challenge"}});
    if (path.endsWith("/bind")) { binding = {network: calls.findLast(c=>c.path.endsWith("/challenge"))!.body.network,payer}; return route.fulfill({json:{...binding,statusUrl:"/status/"+"x".repeat(43)}}); }
    if (request.method() === "POST") return route.fulfill({json:{paid}});
    return route.fulfill({json:{amount:"25.00",recipient,deadline:Math.floor(Date.now()/1000)+1800,language:"Русский",paid,binding,statusUrl:binding?"/status/"+"x".repeat(43):null,networks:[...networks,{...TRON_PAYMENT,recipient:"TLjWhpJwVAmYYv55CVYDVppenstMXvX3si",data:"00"}]}});
  });
  await page.goto("/pay/demo");
  await expect(page.getByRole("heading",{name:"Оплата Astro Прогноза"})).toBeVisible();
  return { calls, markPaid:()=>{paid=true;} };
}
test("compares five networks, signs the wallet binding and pays once on BNB", async ({page}) => {
  const {calls,markPaid} = await setup(page);
  await expect(page.getByRole("radio")).toHaveCount(5);
  await expect(page.getByText("Bitcoin",{exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Подключить кошелёк и сравнить комиссии"}).click();
  await expect(page.getByRole("radio",{name:/Polygon/})).toBeChecked();
  await page.getByRole("radio",{name:/BNB Chain/}).check();
  await page.getByRole("button",{name:"Оплатить через MetaMask",exact:true}).click();
  await expect(page.getByRole("button",{name:"Проверить перевод",exact:true})).toBeVisible();
  const walletCalls = await page.evaluate(()=>(window as any).walletCalls);
  expect(walletCalls.filter((c:any)=>c.method==="eth_sendTransaction")).toHaveLength(1);
  expect(walletCalls.findIndex((c:any)=>c.method==="personal_sign")).toBeLessThan(walletCalls.findIndex((c:any)=>c.method==="eth_sendTransaction"));
  expect(walletCalls.find((c:any)=>c.method==="eth_sendTransaction").params[0].to).toBe(PAYMENT_NETWORKS.bnb.token);
  expect(calls.find(c=>c.path.endsWith("/challenge"))?.body.network).toBe("bnb");
  await expect(page.getByRole("radio",{name:/Polygon/})).toBeDisabled();
  markPaid(); await page.getByRole("button",{name:"Проверить перевод",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Оплата получена"})).toBeVisible();
  await expect(page.getByRole("link",{name:"Статус заказа и PDF"})).toBeVisible();
});
test("rechecks the gas balance before requesting any signature or transfer", async ({page}) => {
  await setup(page,true);
  await page.getByRole("button",{name:"Подключить кошелёк и сравнить комиссии"}).click();
  await page.getByRole("button",{name:"Оплатить через MetaMask",exact:true}).click();
  await expect(page.getByRole("status").last()).toContainText("Не хватает монет для комиссии");
  const calls = await page.evaluate(()=>(window as any).walletCalls);
  expect(calls.some((c:any)=>c.method==="personal_sign" || c.method==="eth_sendTransaction")).toBe(false);
});
test("mobile fee comparison fits without horizontal overflow", async ({page}) => {
  await page.setViewportSize({width:390,height:844}); await setup(page);
  await page.getByRole("button",{name:"Подключить кошелёк и сравнить комиссии"}).click();
  await expect(page.getByText("Наименьшая оценённая комиссия")).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
  await page.screenshot({path:".validation/wallet-multichain-mobile.png",fullPage:true});
  await page.setViewportSize({width:1280,height:1100});
  await page.screenshot({path:".validation/wallet-multichain-desktop.png",fullPage:true});
});
