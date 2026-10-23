import {test,expect}from'@playwright/test';
for(const locale of ['en','ru','es','de'])test(`three directions preserve ${locale} at checkout`,async({page})=>{
  for(const product of ['vedic_basic','vedic_plus','portrait','daily','monthly','tarot']){
    const area=product.startsWith('vedic_')?'vedic':product==='tarot'?'tarot':'western';
    await page.goto(`/?lang=${locale}#${area}`);
    await expect(page.locator('html')).toHaveAttribute('lang',locale);
    await page.locator(`[data-product="${product}"]:visible`).first().click();
    await page.locator('#customer-name').fill('Maya Test');await page.locator('#customer-email').fill('test@sandbox.invalid');
    if(product!=='tarot'){await page.locator('#birth-date').fill('1990-04-12');await page.locator('#birth-time').fill('08:30');await page.locator('#birth-city').fill('Berlin');await page.locator('#birth-country').fill('Germany')}
    await page.locator('#privacy-consent').check();
    let payload:any;await page.route('**/api/trpc/booking.submit',async route=>{payload=route.request().postDataJSON().json;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({result:{data:{json:{invoiceUrl:'/?lang='+locale+'&checkoutTest='+product+'#'+area}}}})})});
    await page.locator('#order-form [type=submit]').click();
    await page.waitForURL(url=>url.searchParams.get('checkoutTest')===product);
    await expect.poll(()=>payload?.product).toBe(product);expect(payload.language).toBe({en:'English',ru:'Русский',es:'Español',de:'Deutsch'}[locale]);expect(payload.name).toBe('Maya Test');
    await page.unroute('**/api/trpc/booking.submit');
  }
});
