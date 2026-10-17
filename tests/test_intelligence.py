import importlib.util
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
spec=importlib.util.spec_from_file_location('intelligence',ROOT/'scripts/build_intelligence.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class ArticleEvidence(unittest.TestCase):
    def test_private_and_unapproved_article_urls_are_rejected(self):
        for url in ['http://bbc.com/news/x','https://bbc.com.attacker.org/x','https://127.0.0.1/','https://user:secret@bbc.com/']:
            with self.assertRaises(ValueError):m.allowed_url(url,check_dns=False)
        self.assertEqual(m.allowed_url('https://www.bbc.com/news/x',check_dns=False),'https://www.bbc.com/news/x')

    def test_article_reader_ignores_navigation_and_rejects_paywall(self):
        paragraph='Inflation and interest rates can influence borrowing and household spending. '
        html='<html><nav>Navigation junk</nav><main><p>'+paragraph*12+'</p></main></html>'
        text=m.extract_article(html)
        self.assertNotIn('Navigation junk',text)
        self.assertIn('Inflation',text)
        with self.assertRaises(ValueError):m.extract_article('<main><div id="paywall">Subscribe</div><p>'+paragraph*12+'</p></main>')

    def test_model_must_cite_actual_evidence_and_include_conditions(self):
        evidence={'E1':'Inflation increased in the latest release.'}
        good={'summary':'The release reports higher inflation.','evidence_ids':['E1'],'chain':['Reported inflation increase','Potentially tighter monetary conditions'],'gold':{'direction':'mixed','condition':'Depends on real yields and hedge demand.'},'bitcoin':{'direction':'unclear','condition':'Depends on risk appetite and liquidity.'},'uncertainty':'The release may be revised and the move may be priced.'}
        self.assertEqual(m.validate_analysis(good,evidence)['gold']['direction'],'mixed')
        good['evidence_ids']=['E99']
        with self.assertRaises(ValueError):m.validate_analysis(good,evidence)
        good['evidence_ids']=['E1'];good['summary']='Bitcoin will rise 20% tomorrow.'
        with self.assertRaises(ValueError):m.validate_analysis(good,evidence)

    def test_quoted_evidence_is_short_and_from_the_actual_body(self):
        body='The central bank indicated that interest rates depend on incoming inflation data. Gold market participants consider real yields and the dollar when assessing demand.'
        evidence=m.evidence_blocks(body)
        for text in evidence.values():
            self.assertLessEqual(len(text.split()),12)
            self.assertIn(text,body)

if __name__=='__main__':unittest.main()
