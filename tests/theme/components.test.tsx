import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { Badge, Button, EmptyState, ICON_NAMES, Message, Modal, Options, SelectField, Tag, TextField } from "../../src/shared/ui";

/**
 * Contrato de los componentes de base con el sistema de diseño (RNF-06/RNF-09):
 * emiten las clases de design-system.css y cumplen las reglas de accesibilidad del
 * paquete (ningún estado sólo por color, campos con etiqueta, errores anunciados).
 */
const css = readFileSync(join(process.cwd(), "src/styles/design-system.css"), "utf8");
const render = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("Íconos", () => {
  it("cada nombre de Icon tiene su máscara en design-system.css (si no, el ícono sale vacío)", () => {
    const missing = ICON_NAMES.filter((name) => !css.includes(`.ic-${name}{--i:url(`));
    expect(missing).toEqual([]);
  });
});

describe("Button", () => {
  it("emite la variante, el tamaño y el ícono del sistema", () => {
    expect(render(<Button>Cobrar</Button>)).toContain('class="boton boton--primario"');
    expect(render(<Button variant="fantasma" size="compacto" icon="close">Vaciar</Button>))
      .toMatch(/class="boton boton--fantasma boton--compacto".*class="ic ic-close ic--s"/);
    expect(render(<Button variant="secundario" block>Ver cuenta</Button>)).toContain("boton--bloque");
  });

  it("sólo el peligro puede rellenarse para confirmar lo que no se deshace", () => {
    expect(render(<Button variant="peligro" confirmar>Anular venta</Button>)).toContain("boton--peligro boton--confirmar");
    expect(render(<Button variant="primario" confirmar>Guardar</Button>)).not.toContain("boton--confirmar");
  });

  it("ocupado: deshabilitado y anunciado", () => {
    const html = render(<Button loading>Guardando…</Button>);
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-busy="true"');
  });
});

describe("Campos", () => {
  it("TextField: la etiqueta apunta al input y el error se anuncia y marca el campo", () => {
    const html = render(<TextField id="monto" label="Monto" error="El monto es obligatorio." suffix="$" numeric />);
    expect(html).toContain('<label class="campo__etiqueta" for="monto">Monto</label>');
    expect(html).toContain('class="campo campo--error"');
    expect(html).toContain('class="entrada entrada--cifra"');
    expect(html).toMatch(/<input id="monto" aria-invalid="true" aria-describedby="monto-desc"/);
    expect(html).toMatch(/<p id="monto-desc" class="campo__ayuda" role="alert">.*El monto es obligatorio\./);
    expect(html).toContain('<span class="entrada__sufijo">$</span>');
  });

  it("SelectField: select nativo dentro de .selector, con su etiqueta", () => {
    const html = render(<SelectField id="caja" label="Caja"><option>Caja 1</option></SelectField>);
    expect(html).toContain('<label class="campo__etiqueta" for="caja">Caja</label>');
    expect(html).toMatch(/<div class="selector"><select id="caja">/);
    expect(html).toContain("ic-keyboard_arrow_down");
  });

  it("SelectField inline: la etiqueta va adentro como prefijo, sin .campo", () => {
    const html = render(<SelectField inline id="marca" label="Marca"><option>Todas</option></SelectField>);
    expect(html).toMatch(/^<div class="selector"><label class="selector__prefijo" for="marca">Marca<\/label><select id="marca">/);
    expect(html).not.toContain("campo");
  });
});

describe("Estados", () => {
  it("Badge: aviso, error, éxito y crítico llevan ícono además del color", () => {
    for (const tone of ["exito", "aviso", "error", "critico"] as const) {
      expect(render(<Badge tone={tone}>x</Badge>), tone).toMatch(new RegExp(`class="estado estado--${tone}"><span class="ic `));
    }
    expect(render(<Badge tone="neutro">Cerrado</Badge>)).toBe('<span class="estado estado--neutro">Cerrado</span>');
    expect(render(<Badge tone="aviso" icon={null}>x</Badge>)).not.toContain("ic ");
  });

  it("Tag: chip con aria-pressed y tilde", () => {
    const html = render(<Tag active>Sin TACC</Tag>);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('class="chip"');
    expect(html).toContain("ic-check");
  });

  it("Message: los errores se anuncian de inmediato; el resto como estado", () => {
    expect(render(<Message tone="error">No se pudo guardar.</Message>)).toMatch(/class="mensaje mensaje--error" role="alert"/);
    expect(render(<Message tone="exito">Guardado.</Message>)).toMatch(/class="mensaje mensaje--exito" role="status"/);
  });

  it("EmptyState: ícono y frase en negrita", () => {
    expect(render(<EmptyState title="Todavía no hay clientes" />)).toMatch(/class="vacio"><span class="ic ic-inbox".*<strong>Todavía no hay clientes<\/strong>/);
  });
});

describe("Options", () => {
  it("un radiogroup con nombre, una opción por radio y la elegida marcada", () => {
    const html = render(
      <Options name="medio" legend="Medio de pago" value="qr" onChange={() => {}}
        options={[{ value: "cash", label: "Efectivo", icon: "payments" }, { value: "qr", label: "QR", icon: "qr_code_2" }]} />
    );
    expect(html).toContain('class="opciones" role="radiogroup" aria-label="Medio de pago"');
    expect(html.match(/type="radio" name="medio"/g)).toHaveLength(2);
    expect(html).toMatch(/<input type="radio" name="medio"( checked="")? value="cash"\/>/);
    expect(html).toMatch(/<input type="radio" name="medio" checked="" value="qr"\/>/);
    expect(html).not.toMatch(/checked="" value="cash"/);
    expect(html).toContain("opcion__check");
  });

  it("segmento sin tilde y con la leyenda visible enlazada", () => {
    const html = render(
      <Options name="rango" legend="Rango" showLegend variant="segmento" value="7" onChange={() => {}}
        options={[{ value: "7", label: "7 días" }, { value: "30", label: "30 días" }]} />
    );
    expect(html).toContain("opciones opciones--segmento");
    expect(html).toMatch(/<p class="campo__etiqueta" id="([^"]+)">Rango<\/p><div class="opciones opciones--segmento" role="radiogroup" aria-labelledby="\1"/);
    expect(html).not.toContain("opcion__check");
  });
});

describe("Modal", () => {
  it("dialog nativo con título enlazado y botón Cerrar con nombre", () => {
    const html = render(<Modal open={false} title="Peso de Nuez" onClose={() => {}}>cuerpo</Modal>);
    expect(html).toMatch(/<dialog class="modal" aria-labelledby="([^"]+)">.*<h2 id="\1" class="titulo-modal">Peso de Nuez<\/h2>/);
    expect(html).toContain('aria-label="Cerrar"');
    expect(render(<Modal open={false} wide title="x" onClose={() => {}} />)).toContain('class="modal modal--ancho"');
  });
});
