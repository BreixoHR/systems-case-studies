# 06 · Dimensionamiento de una sala de servidores (rack, SAI y alimentación)

**Contexto:** la empresa quería centralizar en la oficina el almacenamiento de proyectos, las copias de seguridad, el acceso por VPN y algunas máquinas virtuales. Antes de pedir presupuestos al electricista había que saber **cuánta potencia necesitaba el rack**, y con qué margen.

## Alcance funcional

- **Seguridad:** filtrado de red con un firewall, usuarios VPN, carpetas compartidas con control de acceso, gestión de contraseñas.
- **Redundancia:** NAS con discos en RAID para proyectos y copias automáticas de los servicios cloud (OneDrive, AWS, Salesforce…).
- **Disponibilidad:** acceso remoto por VPN y publicación de servicios internos.
- **Máquinas virtuales:** puestos virtuales para alargar la vida de equipos obsoletos.

## Inventario y consumo

| Equipo | Típico | Pico |
|---|---|---|
| Servidor en rack (2 PSU) | 400 W | 600 W |
| NAS de 6 bahías con discos | 70 W | 120 W |
| Switch de 24 puertos sin PoE | 30–40 W | 50 W |
| Switch de 24 puertos PoE (presupuesto PoE 370 W) | — | 400 W |
| Firewall | 35 W | 50 W |
| PC de administración y monitor | 150 W | 250 W |
| Accesorios del rack (ventilación, iluminación) | 20 W | 30 W |
| Pérdidas del SAI | +10 % sobre la carga | |
| **Margen de diseño** (picos, arranque, crecimiento) | | **+20 %** |

## Resultado

| | Potencia | Corriente a 230 V |
|---|---|---|
| Funcionamiento típico (con SAI) | ≈ 1,10 kW | ≈ 4,9 A |
| Máximo de diseño (pico + 20 %) | ≈ 1,92 kW | ≈ 8,5 A |

- **SAI:** online de doble conversión de 3 kVA. Con el factor de potencia de entrada (≈ 0,98) cubre el máximo de diseño con holgura.
- **Requisito para el electricista:** **un circuito dedicado de 20 A**, monofásico a 230 V. Que sea dedicado evita que otro consumo de la oficina tumbe el rack.
- **Rack:** 42U, 600 × 800 mm (ancho × fondo), con ventilación.

## Lecciones

- El **switch PoE** es el que más pesa en el pico: su presupuesto PoE (370 W) supera al servidor en reposo. Es fácil de pasar por alto si solo se mira el consumo "del switch".
- Entregar al electricista **un único requisito claro** (un circuito de 20 A dedicado), en lugar de una tabla de consumos, evitó idas y venidas.
