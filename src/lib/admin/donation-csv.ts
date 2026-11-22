import {parse} from 'csv-parse/browser/esm/sync';
export type DonationCopy={title:string;author:string;class_name:string};
export function parseDonationCsv(text:string):DonationCopy[]{
 if(new TextEncoder().encode(text).length>200000)throw Error('CSV must be under 200 KB.');
 const rows=parse(text,{columns:true,skip_empty_lines:true,trim:true,bom:true}) as Record<string,string>[];
 if(!rows.length||rows.length>200)throw Error('Use 1–200 rows with title,author,class_name headers.');
 return rows.map((row,i)=>{const copy={} as DonationCopy;for(const field of ['title','author','class_name'] as const){const value=row[field]?.trim();if(!value)throw Error(`Row ${i+2}: title, author and class_name are required.`);if(value.length>250)throw Error(`Row ${i+2}: ${field} must be 250 characters or fewer. Please shorten it before importing.`);copy[field]=value}return copy});
}
