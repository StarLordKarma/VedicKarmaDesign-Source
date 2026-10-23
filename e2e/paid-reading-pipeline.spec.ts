import{test,expect}from'@playwright/test';
const mockUrl=process.env.SANDBOX_MOCK_URL||'http://127.0.0.1:4010',token=process.env.SANDBOX_AUTH_TOKEN||'sandbox-login-token-change-me-32-characters';
for(const[product,language,locale]of[['daily','Español','es'],['tarot','Deutsch','de']])test(`${product}: verified sandbox payment, worker PDF and localized email`,async({page,request})=>{
 const email=`audit-${product}@sandbox.invalid`;
 const response=await request.post('/api/trpc/booking.submit',{data:{json:{name:'Maya Pipeline Test',email,language,product,addon:false,currency:'USD',birthDate:product==='tarot'?'':'1990-04-12',birthTime:product==='tarot'?'':'08:30',birthCity:product==='tarot'?'':'Berlin',birthCountry:product==='tarot'?'':'Germany',currentZone:'Europe/Berlin',privacyAcknowledged:true,privacyNoticeVersion:'privacy-2026-10-21',privacyLocale:locale}}});
 expect(response.ok()).toBeTruthy();const booking=(await response.json()).result.data.json;
 await page.goto(booking.invoiceUrl);await page.getByRole('button',{name:'Confirm test payment'}).click();await expect(page.locator('#result')).toContainText('"confirmed":true');
 await page.goto('/api/auth/login?token='+encodeURIComponent(token));await page.goto('/admin/report-studio');
 await page.getByRole('button',{name:new RegExp('booking #'+booking.id+'\\b')}).click();
 await page.getByRole('button',{name:/Resolve location & render preview/}).click();await expect(page.getByRole('link',{name:'Open PDF'})).toBeVisible({timeout:90000});
 await page.getByText(/I checked the source facts/).locator('..').getByRole('checkbox').check();await page.getByRole('button',{name:/Approve PDF for delivery/}).click();await expect(page.getByRole('button',{name:/Delivered/})).toBeVisible({timeout:30000});
 const messages=(await(await request.get(mockUrl+'/messages')).json()).data;
 const delivered=messages.filter((m:any)=>m.to?.includes(email)&&m.attachmentCount===1);expect(delivered).toHaveLength(1);expect(delivered[0].html).toContain('Maya Pipeline Test');expect(delivered[0].html).toContain('lang="'+locale+'"');
});
