import{describe,it,expect}from'vitest';import{newWording,validateRewrite,isDistinctEdition}from'./wording';import{discloseUnchanged,REPEAT_NOTICE,canDiscloseUnchanged}from'./repeat-disclosure';
const content={language:'en',sections:[{title:'A theme',body:'A clear conversation can help you review the agreement.',paragraphs:['A clear conversation can help you review the agreement.']},{title:'A practical step',body:'Choose a manageable task before adding another commitment.',paragraphs:['Choose a manageable task before adding another commitment.']}]};
describe('repeat order wording',()=>{it('changes wording while retaining immutable report metadata',async()=>{const r=await newWording(content,[content],async()=>[['Review the agreement through a calm and clear conversation.'],['Before making more promises, select one task you can manage.']]);expect(r.needsWordingReview).toBe(false);expect(isDistinctEdition(r.content,[content])).toBe(true);expect(content.sections[0].body).toContain('clear conversation')});it('rejects invented numbers',()=>{expect(()=>validateRewrite(content,[['There will be 3 helpful events.'],['Choose the same manageable task.']])).toThrow('Numerical')});it('does not silently replace text if the provider fails',async()=>{const r=await newWording(content,[content],async()=>{throw Error('offline')});expect(r.needsWordingReview).toBe(true);expect(r.content).toEqual(content)});it.each(['en','ru','es','de'] as const)('unchanged calculation gets an explicit %s disclosure',lang=>{const r=discloseUnchanged({...content,language:lang},'portrait');expect(r.repeatDisclosure).toBe('unchanged-calculation');expect(r.sections[1].body).toBe(REPEAT_NOTICE[lang].body);expect(content.sections).toHaveLength(2)})});

describe('objective repeat disclosure',()=>{
  it('uses the most recent comparable report, not an older matching order',()=>{
    expect(canDiscloseUnchanged([{calculationFingerprint:'changed'},{calculationFingerprint:'same'}],'same')).toBe(false);
    expect(canDiscloseUnchanged([{calculationFingerprint:'same'}],'same')).toBe(true);
    expect(canDiscloseUnchanged([],'same')).toBe(false);
    expect(canDiscloseUnchanged([{}],'same')).toBe(false);
  });
  it('keeps the saved notice stable on retries',()=>{
    const report=discloseUnchanged(content,'portrait');
    expect(discloseUnchanged(report,'portrait')).toEqual(report);
  });
});
