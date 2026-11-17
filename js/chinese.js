/* Chinese music for Mahjong, played live on a plucked zither (guzheng-style) voice.
   "Jasmine Flower" (Mo Li Hua) is a traditional Qing-dynasty folk song (public domain).
   The other two are original tunes written in the traditional pentatonic style.
   Voices: lists of [midi note or 0 for rest, length in units]; all voices in a piece add up to the same length. */
var ChineseMusic = [
  { title: 'Jasmine Flower (Mo Li Hua)', composer: 'traditional folk song', unit: 0.17, repeat: 2, inst: 'zheng',
    voices: [
      [[71, 2], [71, 1], [74, 1], [76, 1], [79, 1], [79, 1], [76, 1], [74, 2], [74, 1], [76, 1], [74, 4],
       [71, 2], [71, 1], [74, 1], [76, 1], [79, 1], [79, 1], [76, 1], [74, 2], [74, 1], [76, 1], [74, 4],
       [74, 2], [74, 2], [74, 2], [71, 1], [74, 1], [76, 2], [76, 2], [74, 4],
       [71, 2], [69, 1], [71, 1], [74, 1], [71, 1], [69, 2], [67, 2], [67, 1], [69, 1], [67, 4],
       [71, 1], [69, 1], [67, 1], [71, 1], [69, 4], [71, 2], [74, 1], [76, 1], [79, 2], [74, 2],
       [69, 1], [71, 1], [74, 1], [69, 1], [71, 1], [67, 1], [64, 1], [62, 1],
       [64, 1], [67, 1], [69, 1], [71, 1], [67, 1], [69, 1], [64, 1], [62, 1], [62, 8]],
      [[55, 8], [55, 8], [55, 8], [55, 8], [55, 8], [50, 8], [52, 8], [55, 8], [55, 8], [50, 8], [52, 8], [52, 8], [55, 8]]
    ] },
  { title: 'Bamboo Breeze', composer: 'in the traditional style', unit: 0.17, repeat: 2, inst: 'zheng',
    voices: [
      [[74, 2], [76, 2], [79, 4], [81, 2], [79, 2], [76, 2], [74, 2], [76, 2], [74, 2], [71, 2], [69, 2], [67, 8],
       [69, 2], [71, 2], [74, 2], [76, 2], [79, 4], [76, 4], [74, 2], [76, 1], [74, 1], [71, 2], [69, 2], [67, 8]],
      [[55, 8], [50, 8], [52, 8], [55, 8], [57, 8], [52, 8], [50, 8], [55, 8]]
    ] },
  { title: 'Lantern Night', composer: 'in the traditional style', unit: 0.19, repeat: 2, inst: 'zheng',
    voices: [
      [[74, 4], [71, 2], [69, 2], [66, 4], [69, 4], [71, 2], [74, 2], [76, 2], [78, 2], [76, 8],
       [78, 2], [76, 2], [74, 2], [71, 2], [69, 4], [71, 4], [66, 2], [69, 2], [71, 1], [69, 1], [66, 2], [62, 8]],
      [[50, 8], [45, 8], [47, 8], [45, 8], [50, 8], [43, 8], [45, 8], [50, 8]]
    ] }
];
if (typeof module !== 'undefined') module.exports = ChineseMusic;
