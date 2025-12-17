import React from 'react';

export default function NewsletterMail({ subject, content }){
  return (
    <div style={{fontFamily:'Arial, sans-serif',color:'#111'}}>
      <h1>{subject}</h1>
      <div>{content}</div>
      <footer style={{marginTop:20,fontSize:12,color:'#666'}}>© Athena</footer>
    </div>
  );
}
