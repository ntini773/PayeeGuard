/** Small builders for read-only Studio widgets. The backend only ever returns an id from a fixed menu; these turn the id into a widget. */
export const col = (type: string, cat: string, vals: string[]) => ({ type, dataMapping: { categoryKey: [{ id: cat }], valueKey: vals.map(id => ({ id, aggregation: 'sum' })) } });
export const cnt = (type: string, cat: string) => ({ type, dataMapping: { categoryKey: [{ id: cat }], valueKey: [{ id: 'cases.case_id', aggregation: 'count' }] } });
export const DAY_WINDOWS = [1, 2, 3, 5, 7, 14, 30];
