import { expect, it } from 'vitest';
import { messages } from './messages';

it('ships every interface message in Chinese and English without placeholders', () => {
  for (const [key, pair] of Object.entries(messages)) {
    expect(pair.zh.trim(), `${key}.zh`).not.toBe('');
    expect(pair.en.trim(), `${key}.en`).not.toBe('');
    expect(pair.zh, key).toMatch(/[\u3400-\u9fff]/);
    expect(pair.en, key).toMatch(/[A-Za-z]/);
    expect(`${pair.zh} ${pair.en}`, key).not.toMatch(/TODO|TBD|lorem ipsum/i);
  }
});
