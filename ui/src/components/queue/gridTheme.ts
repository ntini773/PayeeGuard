import { themeQuartz } from 'ag-grid-community';

/** AG Grid's own theming API, in the shared PayeeGuard workspace palette. Shared by the queue and the audit grid. */
export const operatorGridTheme = themeQuartz.withParams({
  backgroundColor: '#FFFFFF',
  foregroundColor: '#23374b',
  headerBackgroundColor: '#edf2f8',
  headerTextColor: '#506a82',
  borderColor: '#d8e2eb',
  oddRowBackgroundColor: '#fbfcfe',
  rowHoverColor: '#eff4fa',
  selectedRowBackgroundColor: '#e4edf7',
  accentColor: '#668bad',
  fontFamily: 'Geist, system-ui, sans-serif',
  fontSize: 14,
  rowHeight: 52,
  headerHeight: 46,
  headerFontWeight: 600,
});
