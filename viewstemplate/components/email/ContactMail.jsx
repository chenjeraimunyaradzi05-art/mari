import React from 'react';

export default function ContactMail({ fromName, email, message }){
  return (
    <div style={{fontFamily:'Arial, sans-serif',color:'#111'}}>
      <h2>Contact message from {fromName} &lt;{email}&gt;</h2>
      <div style={{marginTop:8}}>{message}</div>
    </div>
  );
}
