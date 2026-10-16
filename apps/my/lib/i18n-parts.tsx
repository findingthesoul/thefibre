// A translated sentence with a LINK (or any element) inside it.
//
// `t()` substitutes strings. When the thing in the middle of a sentence is a
// link, the sentence cannot be glued together from an English prefix and
// suffix — German puts the comma after it, Dutch the verb at the end. So the
// catalog carries the whole sentence with a {placeholder}, and this splits it
// around the placeholder and drops the element in, in whatever position that
// language put it.

import { Fragment, type ReactNode } from 'react';

export function parts(sentence: string, slots: Record<string, ReactNode>): ReactNode {
  const out: ReactNode[] = [];
  const re = /\{(\w+)\}/g;
  let last = 0;
  let i = 0;
  for (let m = re.exec(sentence); m; m = re.exec(sentence)) {
    if (m.index > last) out.push(sentence.slice(last, m.index));
    const name = m[1]!;
    // An unknown slot stays visible as written: a missing link should look
    // wrong in review, not vanish.
    out.push(name in slots ? <Fragment key={`s${i++}`}>{slots[name]}</Fragment> : m[0]);
    last = m.index + m[0].length;
  }
  if (last < sentence.length) out.push(sentence.slice(last));
  return out;
}
