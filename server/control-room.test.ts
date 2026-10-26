import {describe,it,expect} from 'vitest';
import {audienceEventSchema,controlRoomFilters,controlRoomRouter,audienceHash} from './control-room';
describe('control room boundaries',()=>{
 it('does not allow anonymous or ordinary users to read operational statistics',async()=>{
  const input={from:'2026-10-01',to:'2026-10-26',section:'all',locale:'all'} as const;
  for(const user of [null,{openId:'untrusted',role:'user'}]){const caller=controlRoomRouter.createCaller({user,req:{},res:{}} as any);await expect(caller.summary(input)).rejects.toMatchObject({code:'FORBIDDEN'})}
 });
 it('requires explicit consent and rejects PII, URLs and client-defined financial events',()=>{
  const event={consent:true,eventId:crypto.randomUUID(),visitor:crypto.randomUUID(),session:crypto.randomUUID(),event:'page_view',section:'vedic',product:'none',locale:'ru',device:'desktop',source:'instagram',medium:'social',campaign:'october_2026'};
  expect(audienceEventSchema.safeParse(event).success).toBe(true);
  for(const change of [{consent:false},{email:'private@example.org'},{campaign:'https://example.org/private'},{source:'someone@example.org'},{event:'payment_confirmed'}])expect(audienceEventSchema.safeParse({...event,...change}).success).toBe(false);
  expect(audienceHash(event.visitor)).not.toContain(event.visitor);expect(audienceHash(event.visitor)).toHaveLength(64);
 });
 it('rejects impossible dates, reversed and excessive periods',()=>{
  for(const [from,to]of [['2026-02-30','2026-03-02'],['2026-10-26','2026-10-01'],['2026-01-01','2026-12-31']])expect(controlRoomFilters.safeParse({from,to}).success).toBe(false);
  expect(controlRoomFilters.safeParse({from:'2026-10-01',to:'2026-10-26'}).success).toBe(true);
 });
});
