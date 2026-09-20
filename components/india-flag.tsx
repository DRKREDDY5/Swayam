export function IndiaFlag() {
 return <svg className="india-flag" viewBox="0 0 90 60" role="img" aria-label="India">
  <path fill="#ff9933" d="M0 0h90v20H0z"/>
  <path fill="#fff" d="M0 20h90v20H0z"/>
  <path fill="#138808" d="M0 40h90v20H0z"/>
  <g fill="none" stroke="#000080" strokeWidth=".65">
   <circle cx="45" cy="30" r="8.5"/>
   {Array.from({length:24},(_,i)=><path key={i} d="M45 30V21.5" transform={`rotate(${i*15} 45 30)`}/>)}
  </g><circle cx="45" cy="30" r="1.2" fill="#000080"/>
 </svg>;
}
