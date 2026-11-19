"""Reproducible local Docling comparison; public PDF fixtures only, no database or paid APIs."""
import os
os.environ.setdefault('HF_HOME', os.path.expanduser('~/.cache/letsrace-docling-review'))
os.environ.setdefault('HF_HUB_DISABLE_TELEMETRY', '1')
os.environ.setdefault('TOKENIZERS_PARALLELISM', 'false')
import json, time, sys, importlib.metadata
from pathlib import Path
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions, RapidOcrOptions, OcrMacOptions
from docling.datamodel.accelerator_options import AcceleratorOptions
root=Path(__file__).resolve().parent
mode=sys.argv[1] if len(sys.argv)>1 else 'rapid'
selected={int(i) for i in sys.argv[2].split(',')} if len(sys.argv)>2 else None
languages=['cs-CZ','pl-PL','de-DE','it-IT','fr-FR','en-US']
ocr=OcrMacOptions(lang=languages, recognition='accurate', force_full_page_ocr=mode.endswith('-full')) if mode.startswith('vision') else RapidOcrOptions(lang=['en'],force_full_page_ocr=mode.endswith('-full'))
options=PdfPipelineOptions(do_ocr=True, do_table_structure=True, document_timeout=180, ocr_options=ocr, accelerator_options=AcceleratorOptions(num_threads=4,device='cpu'))
converter=DocumentConverter(format_options={InputFormat.PDF:PdfFormatOption(pipeline_options=options)})
manifest=json.loads((root/'manifest.json').read_text())
for case in manifest:
 index=case['index']
 if selected is not None and index not in selected:continue
 stem=f'{mode}-{index:03d}'; result_file=root/f'{stem}.json'
 if result_file.exists():
  print('PRESERVED',stem,flush=True);continue
 page_range={25:(4,4),112:(7,7)}.get(index,(1,case['pages']))
 started=time.monotonic(); print('START',stem,case['name'],page_range,flush=True)
 row={'index':index,'name':case['name'],'url':case['url'],'mode':mode,'docling':importlib.metadata.version('docling'),'page_range':page_range,'ocr_options':ocr.model_dump(mode='json'),'device':'cpu','threads':4}
 try:
  result=converter.convert(case['file'],page_range=page_range,raises_on_error=False)
  row.update(status=str(result.status),errors=[str(e) for e in result.errors])
  doc=result.document
  md=doc.export_to_markdown();text=doc.export_to_text()
  (root/f'{stem}.md').write_text(md)
  (root/f'{stem}.txt').write_text(text)
  (root/f'{stem}-document.json').write_text(json.dumps(doc.export_to_dict(),ensure_ascii=False))
  row.update(characters=len(text),tables=len(doc.tables),pages=len(doc.pages))
 except Exception as error:row.update(status='exception',error=f'{type(error).__name__}: {error}')
 row['seconds']=round(time.monotonic()-started,3)
 result_file.write_text(json.dumps(row,ensure_ascii=False,indent=2))
 print('DONE',stem,row.get('status'),row.get('characters'),row.get('tables'),row['seconds'],flush=True)
