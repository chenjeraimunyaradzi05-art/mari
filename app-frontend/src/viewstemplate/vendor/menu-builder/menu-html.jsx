// Auto-generated React component from Blade: menu-html.blade.php
const React = require('react')

function MenuHtml(props) {
  const { menulist = [], menus = [], roles = [], indmenu } = props

  const menuSelect = Array.isArray(menulist) && menulist.length ?
    React.createElement('select', { name: 'menu' }, menulist.map((m) => React.createElement('option', { key: m.value, value: m.value }, m.label))) :
    React.createElement('div', null, 'No menus available')

  return React.createElement(
    'div',
    { id: 'hwpwrap' },
    React.createElement('div', { className: 'wrap' },
      React.createElement('h1', null, 'Menu Builder (converted)'),
      React.createElement('div', { className: 'manage-menus' },
        React.createElement('form', { method: 'get', action: props.currentUrl || '' },
          React.createElement('label', { htmlFor: 'menu', className: 'selected-menu' }, 'Choose menu'),
          menuSelect,
          React.createElement('span', { className: 'submit-btn' },
            React.createElement('input', { type: 'submit', className: 'button-secondary', value: 'Choose' })
          )
        )
      ),
      React.createElement('div', { id: 'menu-management' },
        React.createElement('form', { id: 'update-nav-menu', method: 'post' },
          React.createElement('div', { className: 'menu-edit' },
            React.createElement('div', { id: 'post-body-content' },
              React.createElement('h3', null, props.menu ? 'Menu structure' : 'Create a menu'),
              React.createElement('ul', { className: 'menu', id: 'menu-to-edit' },
                menus.map((m) => React.createElement('li', { key: m.id }, m.label))
              )
            )
          )
        )
      )
    )
  )
}

module.exports = MenuHtml
// (Note) ESM skeleton removed — file uses CommonJS export for server-side rendering
