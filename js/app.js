const parts = ["./js/parts/app-00.txt", "./js/parts/app-01.txt", "./js/parts/app-02.txt", "./js/parts/app-03.txt", "./js/parts/app-04.txt", "./js/parts/app-05.txt", "./js/parts/app-06.txt", "./js/parts/app-07.txt", "./js/parts/app-08.txt", "./js/parts/app-09.txt", "./js/parts/app-10.txt"];
const code=(await Promise.all(parts.map(async p=>{const r=await fetch(p);if(!r.ok)throw new Error('Falha ao carregar '+p);return r.text();}))).join('');
(new Function(code+'\n//# sourceURL=mhqr-app-v2.1.0.js'))();
