# 05 · Documentación y diagnóstico de la red de oficina

**Contexto:** la red de oficina había crecido sin documentación: dos operadores de fibra, varios switches, extensores y redes Wi-Fi. Cuando algo fallaba, nadie sabía qué equipo dependía de qué.

## Estado documentado

```
[Router operador A] ── [Switch A] ── [Patch panels] ── [Equipos cableados]
                            │
                            └── [Extensor por cable] ── SSID "Planta0"

[Router operador B] ── [Switch B] ── [Puntos de acceso] ── SSIDs de oficina

No existe conexión entre el Switch A y el Switch B.
```

| Red | Operador | Uso | Acceso |
|---|---|---|---|
| Red 1 | Operador A | Equipos fijos y la instalación de pared | Cable y un extensor Wi-Fi conectado por cable |
| Red 2 | Operador B | Portátiles y móviles | Wi-Fi dedicada |

## Valoración

**Buenas prácticas que ya había (y que conviene mantener):**
- Separación física de redes: sin conflictos de DHCP y con segmentación implícita entre equipos fijos y dispositivos Wi-Fi.
- Redundancia de operador: si cae uno, el otro sigue funcionando en su red.
- Extensor conectado por cable, más estable que un repetidor inalámbrico.

**Limitaciones:**

| Limitación | Impacto | Recomendación |
|---|---|---|
| Sin comunicación entre la red cableada y la Wi-Fi | Bajo (puede ser deseable) | Router dual-WAN si alguna vez hace falta |
| Varios SSID en el mismo rango, sin VLAN | Medio: difícil de ampliar | Switch gestionable con VLAN |
| Dos operadores gestionados por separado | Trabajo duplicado | Documentar los contactos y el acceso de cada uno |

## Evolución propuesta

Un router **dual-WAN** con los dos operadores: failover real, en lugar de dos redes aisladas.

- **Segmentación:** VLAN en un único switch gestionable.
- **Wi-Fi:** un solo SSID con autenticación centralizada (802.1X o portal cautivo).
- **Cobertura:** sistema mesh profesional si hace falta roaming.

Este diagnóstico es la base del dimensionamiento de la [sala de servidores](06-sala-de-servidores.md).
