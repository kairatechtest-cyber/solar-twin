import { Pipe, PipeTransform } from '@angular/core';
import { fmt, fmtTime, modeName } from '../core/util';

@Pipe({ name: 'fmt', standalone: true })
export class FmtPipe implements PipeTransform { transform(v: number | null | undefined, d = 1) { return fmt(v, d); } }

@Pipe({ name: 'ftime', standalone: true })
export class TimePipe implements PipeTransform { transform(v: string | number | null | undefined) { return fmtTime(v); } }

@Pipe({ name: 'mode', standalone: true })
export class ModePipe implements PipeTransform { transform(v: number | null | undefined) { return modeName(v ?? 0); } }
