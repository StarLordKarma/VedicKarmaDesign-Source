export function localToUtc(date:string,time:string,zone:string,disambiguation?:string):Date;
export function validDate(date:string):Date;
export function dateInZone(instant:Date,zone:string):string;
export function positions(instant:Date):Array<{sign:number;longitude:number}>;
export function natal(input:{birthDate:string;birthTime:string;birthZone:string;latitude:number;longitude:number;disambiguation?:string}):{planets:Array<{sign:number}>;ascendant:number|null};
