// Rewrites files so they are pure ASCII (escapes any non-ASCII character).
var fs = require('fs');
var BS = String.fromCharCode(92);
process.argv.slice(2).forEach(function (f) {
  var s = fs.readFileSync(f, 'utf8'), out = '', n = 0;
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c > 127) {
      n++;
      var hex = c.toString(16).toUpperCase();
      if (/\.css$/.test(f)) out += BS + hex + ' ';
      else if (/\.js$/.test(f)) out += BS + 'u' + ('000' + hex).slice(-4);
      else out += '&#x' + hex + ';';
    } else out += s[i];
  }
  if (n) fs.writeFileSync(f, out);
  console.log(f, n);
});
