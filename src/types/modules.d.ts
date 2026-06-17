// pdf-parse's package entry runs a debug block on import that crashes under bundlers;
// importing the inner module avoids it. That path ships no types, so declare it.
declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult {
    text: string;
    numpages: number;
    info: unknown;
  }
  function pdfParse(dataBuffer: Buffer): Promise<PdfParseResult>;
  export default pdfParse;
}
