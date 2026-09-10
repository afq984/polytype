# Licensing scope

Polytype's original code and documentation are licensed under the MIT license
in LICENSE. This does not replace the following third-party terms:

- The McBopomofo dictionary subset retains its MIT license and historical libtabe
  notices in data/sources/mcbopomofo/. See data/chinese-source.json for provenance.
- The modified SCOWL subset retains the licenses and notices in
  data/sources/scowl/Copyright. See data/english-source.json for its sources and
  transformations. These include permissive licenses and public-domain material;
  they are not all covered by Polytype's MIT grant.
- Sourced evaluation text and adapted annotations retain their attribution and
  CC BY-SA terms, documented in eval/README.md and eval/sources/. The project MIT
  license does not relicense this material. It is not compiled into the demo.
- Cargo dependencies retain their own licenses. The build bundles MIT notices
  for the currently locked dependencies, selecting MIT where offered as an
  alternative, plus unicode-ident's additional Unicode license. Build-only
  dependencies are included conservatively. License changes fail the notice
  generator for review rather than being silently treated as MIT.

Both web and standalone builds include Polytype's MIT license, dictionary notices
and dependency notices in their license display. Keep these with redistributed
builds. Cargo.lock pins dependency versions; registry source packages contain
their original license texts.
