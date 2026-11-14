const params=new URL(location.href).searchParams;
for(const a of document.querySelectorAll('[data-preview-entry]')){const u=new URL(a.href);for(const k of ['utm_source','utm_medium','utm_campaign']){const v=params.get(k);if(v&&/^[a-z0-9_.-]{1,64}$/i.test(v))u.searchParams.set(k,v);}a.href=u.href;}
