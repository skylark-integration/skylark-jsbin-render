/**
 * skylark-jsbin-render - A version of jsbin-render  that ported to running on skylarkjs.
 * @author Hudaokeji, Inc.
 * @version v0.9.0
 * @link https://github.com/skylark-integration/skylark-jsbin-render/
 * @license MIT
 */
define(["skylark-jquery","./jsbin"],function(e,t){"use strict";return t.viewer.showEdit=function(e){if("#noedit"!==window.location.hash){var t,i,n=document,o="addEventListener",s=e.root+window.location.pathname,c=n.createElement("link"),a=n.createElement("a");a.id="edit-with-js-bin",a.href=s+("/"===s.slice(-1)?"":"/")+"edit",a.innerHTML='Edit in JS Bin <img src="'+e.static+'/images/favicon.png" width="16" height="16">',n.documentElement.appendChild(a),c.setAttribute("rel","stylesheet"),c.setAttribute("href",e.static+"/css/edit.css"),n.documentElement.appendChild(c),a.onmouseover=a.onmouseout=function(){((i=!i)?d:r)()},d(),o in n?n[o]("mousemove",d,!1):n.attachEvent("mousemove",d)}function d(){clearTimeout(t),a.style.top="0",t=setTimeout(r,2e3)}function r(){i||(a.style.top="-60px")}}});
//# sourceMappingURL=sourcemaps/showEdit.js.map
