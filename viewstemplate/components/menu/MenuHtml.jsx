import React from 'react';

export default function MenuHtml({ menu }) {
  menu = menu || [{ title: 'Home', href: '/' }];
  return (
    <nav>
      <ul className="flex gap-3">
        {menu.map((m, i) => (
          <li key={i}><a href={m.href} className="text-gray-700 hover:text-emerald-600">{m.title}</a></li>
        ))}
      </ul>
    </nav>
  );
}
