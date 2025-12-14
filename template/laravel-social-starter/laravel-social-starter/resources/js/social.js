document.addEventListener('click', (e) => {
  if (e.target.closest('form.react')) {
    const form = e.target.closest('form.react')
    if (e.target.tagName === 'BUTTON') {
      e.preventDefault()
      const fd = new FormData(form)
      fd.set('type', e.target.value)
      fetch(form.action, { method:'POST', headers:{ 'X-CSRF-TOKEN': document.querySelector('meta[name=csrf-token]')?.content || '' }, body: fd})
        .then(r=>r.json()).then(({ok,count})=>{
          if(ok){ form.querySelector('.count').textContent = count }
        })
    }
  }
})
