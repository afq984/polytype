# Licensing scope

Polytype's original code and documentation are licensed under the MIT license
in LICENSE. This does not replace the following third-party terms:

- The McBopomofo dictionary subset retains its MIT license and historical libtabe
  notices in data/sources/mcbopomofo/. See data/chinese-source.json for provenance.
- The unmodified Mozc romaji table and the Mozc open-source dictionary subset
  retain Google's BSD-3-Clause terms in data/sources/mozc/LICENSE, together with
  the IPAdic (NAIST/ICOT) and Okinawa dictionary notices that upstream attaches
  to its dictionary files; data/sources/mozc/README.txt is the upstream
  dictionary README. See data/japanese-source.json for pinned source hashes and
  the selection. These notices are bundled with both demo formats.
- The modified SCOWL subset retains the licenses and notices in
  data/sources/scowl/Copyright. See data/english-source.json for its sources and
  transformations. These include permissive licenses and public-domain material;
  they are not all covered by Polytype's MIT grant.
- Sourced evaluation text and adapted annotations retain their attribution and
  CC BY-SA terms, documented in eval/README.md and eval/sources/. The project MIT
  license does not relicense this material. It is not compiled into the demo.
- ASCEND transcripts by Holy Lovenia, Samuel Cahyawijaya, Genta Indra Winata
  and their coauthors (HLTCHKUST/CAiRE), and UD English EWT sentences/annotations
  by the Universal Dependencies English EWT contributors, retain CC BY-SA 4.0.
  Their selected test-split text and adapted evaluation cases live in eval/zh-en/;
  attribution and source notices are in eval/sources/ASCEND-README.md and
  eval/sources/UD_English-EWT-{README.md,LICENSE.txt}.
- CC-CEDICT evaluation pronunciation annotations retain CC BY-SA 4.0, with
  attribution to its community contributors and publisher MDBG, and the original
  CEDICT work by Paul Andrew Denisowski. The export notice is retained in
  eval/sources/CC-CEDICT-NOTICE.txt. These annotations are independent of the
  runtime dictionary and are not compiled into either demo.
- OpenCC's conversion dictionaries by BYVoid and the OpenCC contributors retain
  Apache-2.0, with the upstream license in eval/sources/OpenCC-LICENSE.txt.
  They are used only for offline evaluation-text conversion. Pinned revisions,
  source hashes and transformation details for these four evaluation sources
  are in eval/sources/zh-en-pins.json and eval/README.md.
- Cargo dependencies retain their own licenses. The build bundles MIT notices
  for the currently locked dependencies, selecting MIT where offered as an
  alternative, plus unicode-ident's additional Unicode license. Build-only
  dependencies are included conservatively. License changes fail the notice
  generator for review rather than being silently treated as MIT.

Both web and standalone builds include Polytype's MIT license, dictionary notices
and dependency notices in their license display. Keep these with redistributed
builds. Cargo.lock pins dependency versions; registry source packages contain
their original license texts.
