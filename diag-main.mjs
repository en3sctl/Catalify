import electron from 'electron';
import * as elecStar from 'electron';
console.log('default type:', typeof electron);
console.log('default hasApp:', !!(electron && electron.app));
console.log('star type:', typeof elecStar);
console.log('star keys:', Object.keys(elecStar).slice(0, 10));
console.log('star.app:', typeof elecStar.app);
process.exit(0);
