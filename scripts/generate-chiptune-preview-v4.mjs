import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const rate = 44_100, tempo = 104, beat = 60 / tempo, eighth = beat / 2, bars = 16;
const duration = bars * beat * 4, frames = Math.ceil(duration * rate);
const left = new Float64Array(frames), right = new Float64Array(frames);
const note = {
  D3:146.83,E3:164.81,G3:196,A3:220,B3:246.94,C4:261.63,D4:293.66,E4:329.63,Fs4:369.99,G4:392,A4:440,B4:493.88,
  C5:523.25,D5:587.33,E5:659.25,Fs5:739.99,G5:783.99,A5:880,B5:987.77,D6:1174.66,
};
const melody = [
  ["B4",null,"D5","G5",null,"Fs5","D5",null], ["G4","B4",null,"E5",null,"D5","B4",null],
  ["E5",null,"D5","B4",null,"G4","A4",null], ["A4",null,"Fs4","A4",null,"D5",null,null],
  ["B4","D5",null,"G5",null,"A5","G5",null], ["E5",null,"B4",null,"G4","B4","D5",null],
  ["E5",null,"G5","B5",null,"A5","G5",null], ["Fs5",null,"D5","A4",null,"D5",null,null],
  ["D5",null,"B4","G4",null,"A4","B4",null], ["E5",null,"G5",null,"B5","G5",null,null],
  ["G5",null,"E5","D5",null,"B4","A4",null], ["A4",null,"D5",null,"Fs5","E5","D5",null],
  ["B4",null,"D5","G5",null,"Fs5","E5",null], ["G4","B4",null,"E5",null,"G5","E5",null],
  ["C5",null,"B4","G4",null,"A4","D5",null], ["Fs5",null,"D5","A4",null,"Fs4","A4",null],
];
const chords = [
  ["G4","B4","D5","Fs5"],["E4","G4","B4","D5"],["C4","E4","G4","B4"],["D4","Fs4","A4","B4"],
  ["G4","B4","D5","Fs5"],["E4","G4","B4","D5"],["C4","E4","G4","B4"],["D4","Fs4","A4","B4"],
  ["G4","B4","D5","Fs5"],["E4","G4","B4","D5"],["C4","E4","G4","B4"],["D4","Fs4","A4","B4"],
  ["G4","B4","D5","Fs5"],["E4","G4","B4","D5"],["C4","E4","G4","B4"],["D4","Fs4","A4","B4"],
];
const roots=["G3","E3","C4","D3","G3","E3","C4","D3","G3","E3","C4","D3","G3","E3","C4","D3"];
const fifths=["D4","B3","G3","A3","D4","B3","G3","A3","D4","B3","G3","A3","D4","B3","G3","A3"];
let seed=0x7f4a21d3;
const noise=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/0xffffffff*2-1;};
const pan=v=>[Math.sqrt((1-v)/2),Math.sqrt((1+v)/2)];

function voice(start,length,freq,volume,wave,stereo=0,duty=.5,attack=.014,release=.2){
  const from=Math.max(0,Math.floor(start*rate)),to=Math.min(frames,Math.ceil((start+length)*rate));
  const [gl,gr]=pan(stereo);
  for(let frame=from;frame<to;frame++){
    const time=frame/rate-start,phase=time*freq%1,env=Math.min(1,time/attack)*Math.min(1,(length-time)/release);
    let value=wave==="pulse"?(phase<duty?1:-1):wave==="triangle"?1-4*Math.abs(Math.round(phase)-phase):wave==="sine"?Math.sin(phase*Math.PI*2):noise();
    value*=volume*Math.max(0,env);left[frame]+=value*gl;right[frame]+=value*gr;
  }
}
function lead(start,freq){
  voice(start,eighth*1.45,freq,.105,"triangle",-.2,.5,.02,.24);
  voice(start,eighth*.72,freq*2,.025,"pulse",.18,.125,.012,.16);
  voice(start+beat*.78,eighth*.8,freq,.024,"triangle",.35,.5,.02,.22);
}

for(let bar=0;bar<bars;bar++){
  const base=bar*beat*4;
  melody[bar].forEach((name,index)=>{if(name)lead(base+index*eighth+(index%2?.025:0),note[name]);});
  for(let step=0;step<8;step++){
    const name=chords[bar][step%4],swing=step%2?.025:0;
    voice(base+step*eighth+swing,eighth*.63,note[name],.032,"pulse",.28,.125,.012,.13);
  }
  voice(base,beat*1.75,note[roots[bar]],.105,"triangle",-.08,.5,.03,.3);
  voice(base+beat*2,beat*1.75,note[fifths[bar]],.08,"triangle",-.08,.5,.03,.3);
  for(let step=0;step<8;step++)voice(base+step*eighth+(step%2?.025:0),.025,1,step%2?.012:.022,"noise",.2,.5,.001,.022);
  [0,2.5].forEach(position=>{voice(base+position*beat,.13,55,.09,"sine",0,.5,.005,.12);voice(base+position*beat,.03,1,.025,"noise",0,.5,.001,.025);});
  [1,3].forEach(position=>voice(base+position*beat,.075,1,.042,"noise",.08,.5,.001,.07));
  if(bar%4===1){voice(base+beat*3.45,beat*.65,note.B5,.03,"triangle",.34,.5,.015,.22);voice(base+beat*3.65,beat*.45,note.D6,.022,"triangle",-.28,.5,.015,.2);}
}
for(let frame=0;frame<frames;frame++){
  const time=frame/rate,fade=Math.min(1,time/.2,(duration-time)/.7);left[frame]*=Math.max(0,fade);right[frame]*=Math.max(0,fade);
}
let peak=.001;for(let i=0;i<frames;i++)peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));
const scale=.87/peak,dataBytes=frames*4,wav=Buffer.alloc(44+dataBytes);
wav.write("RIFF",0);wav.writeUInt32LE(36+dataBytes,4);wav.write("WAVE",8);wav.write("fmt ",12);wav.writeUInt32LE(16,16);
wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write("data",36);wav.writeUInt32LE(dataBytes,40);
for(let i=0;i<frames;i++){wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,left[i]*scale))*32767),44+i*4);wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,right[i]*scale))*32767),46+i*4);}
const output=resolve("previews/sky-parcel-panic-chiptune-v4-chill-happy.wav");mkdirSync(dirname(output),{recursive:true});writeFileSync(output,wav);
console.log(`${output}\n${duration.toFixed(2)} seconds · 104 BPM · stereo PCM WAV · ${rate} Hz`);
