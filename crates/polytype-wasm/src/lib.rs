use wasm_bindgen::prelude::*;

/// Each browser/editor owns its engine and custom dictionary independently.
#[wasm_bindgen]
pub struct Polytype {
    engine: polytype_core::Engine,
}

#[wasm_bindgen]
impl Polytype {
    #[wasm_bindgen(constructor)]
    pub fn new(prototype: bool) -> Self {
        Self {
            engine: if prototype {
                polytype_core::Engine::prototype()
            } else {
                polytype_core::Engine::default()
            },
        }
    }

    pub fn request(&mut self, request: &str) -> Result<String, JsError> {
        self.engine
            .request(request)
            .map_err(|error| JsError::new(&error))
    }
}

impl Default for Polytype {
    fn default() -> Self {
        Self::new(false)
    }
}
