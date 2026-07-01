import { bold, dim, green, greenBright } from 'yoctocolors';

export function printLogo() {
  const logo = [
    '                                                 .',
    '                                               .o#',
    '                             .#######= %###% .o###oo',
    '                            ###\' `##\\  `###    ###',
    '                            ###   ###   ###    ###',
    '                            `##bod#Y\'   ###    ### .',
    '                            `#oooooo.  %###%   "###"',
    '                            d"     YD                      .o#',
    '                            "Y#####P\'                     "###',
    ' .====.# ====    === ===. .==.    .ooooo.   .ooooo.   .oooo###',
    'd##(  "#  `##.  .#\'  `###P"Y##b  d##\' `"Y# d##\' `##b d##\' `###',
    '`"Y##b.    `##..#\'    ###   ###  ###       ###ooo##Y ###   ###',
    '#.  )##b    `###\'     ###   ###  ###   .o# ###    .o ###   ###',
    '#""###P\'     .#\'     o###o o###o `Y#bod#P\' `Y#bod#P\' `Y#bod##P"',
    '         .o..P\'',
    '         `Y#P\'',
  ].map(line => {
    return line.split('').map(char => {
      if (char === '#') {
        // Randomly decide to color the `#` either dim or greenBright
        return Math.random() < 0.6 ? bold(green('#')) : dim(greenBright('#'));
      }
      return dim(green(char));
    }).join('');
  });

  logo.forEach(l => console.log(l));
  console.log('\n');
}
