import { HotTable, HotTableRef } from '@handsontable/react-wrapper';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/styles/handsontable.css';
import 'handsontable/styles/ht-theme-main.css';
import './styleTable.css';
import { useEffect, useRef, useState } from 'react';
import Handsontable from 'handsontable';

registerAllModules();

/*
 * Funcion recursiva
 * Lvl 2 (cuentas) = detalles.debito - detalles.credito
 * Lvl 0 y 1: suma resultado de los hijos 
 */
const computeResultadoFuncion = (row: any): number => {
  if (row.detalles) {
    return row.detalles.debito - row.detalles.credito;
  } else if (row.tiposDeGasto) {
    // Level 0 (tipoGasto)
    return row.tiposDeGasto.reduce(
      (sum: number, child: any) => sum + computeResultadoFuncion(child),
      0
    );
  } else if (row.cuentas) {
    // Level 1 (cuentas)
    return row.cuentas.reduce(
      (sum: number, child: any) => sum + computeResultadoFuncion(child),
      0
    );
  }
  return 0;
};

/* Obtiene el nombre de todos los centros de costos */
function gatherAllCostCenters(data: any[]): string[] {
  const costCenterSet = new Set<string>();

  function traverse(node: any) {

    if (node.detalles?.nombreCentroCostos) {
      costCenterSet.add(node.detalles.nombreCentroCostos.trim());
    }

    if (node.tiposDeGasto) {
      node.tiposDeGasto.forEach(traverse);
    }
    if (node.cuentas) {
      node.cuentas.forEach(traverse);
    }
  }

  data.forEach(traverse);
  return [...costCenterSet];
}

/**
 * Determina que etiqueta se mostrara":
 * Lvl 0: categoriaCuenta
 * Lvl 1: tipoGasto 
 * Lvl 2: nombreCuenta.
 */
const getFuncionLabel = (row: any): string => {
  if (row.categoriaCuenta) return row.categoriaCuenta;
  if (row.tipoGasto) return row.tipoGasto;
  if (row.nombreCuenta) return row.nombreCuenta;
  return '';
};

/**
 * Returns child rows:
 * Level 0 rows have children in "tiposDeGasto".
 * Level 1 rows have children in "cuentas".
 */
const getSubRows = (row: any): any[] | undefined => {
  if (row.tiposDeGasto) return row.tiposDeGasto;
  if (row.cuentas) return row.cuentas;
  return undefined;
};

// Transforma los datos

const transformRow = (
  row: any,
  parentIndex = '',
  childIndex = 0
) => {
  let level = 0;
  if (row.tipoGasto) level = 1;
  if (row.nombreCuenta) level = 2;

  let myIndex = '';

  if (level === 1) {
    // lvl 1 segment0 => "64"
    const firstCuenta = row.cuentas?.[0];
    if (firstCuenta?.detalles?.segment0) {
      myIndex = firstCuenta.detalles.segment0.substring(0, 2);
    }
  } else if (level === 2) {
    // lvl 2 "64a", "64b", etc.
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    myIndex = parentIndex + letters[childIndex];
  }

  let dim1 = 'X';
  let dim2 = 'X';
  let dim3 = 'X';
  let dim4 = 'X';
  let fechaReferencia = 'X';
  let fechaVenc = 'X';
  let _centroCostos = '';

  if (row.detalles) {
    dim1 = row.detalles.dim1 || 'X';
    dim2 = row.detalles.dim2 || 'X';
    dim3 = row.detalles.dim3 || 'X';
    dim4 = row.detalles.dim4 || 'X';
    fechaReferencia = row.detalles.fechaReferencia || 'X';
    fechaVenc = row.detalles.fechaVenc || 'X';

    if (level === 2 && row.detalles.nombreCentroCostos) {
      _centroCostos = row.detalles.nombreCentroCostos.trim();
    }
  }

  const transformed: any = {
    level,
    funcion: getFuncionLabel(row),
    resultadoFuncion: computeResultadoFuncion(row),
    myIndex,
    dim1,
    dim2,
    dim3,
    dim4,
    fechaReferencia,
    fechaVenc,
    _centroCostos,
  };

  const children = getSubRows(row);
  // console.log("Children found:", children);
  if (children && Array.isArray(children)) {
    transformed.__children = children.map((child: any, idx: number) => {
      return transformRow(child, myIndex, idx)
    });
  }
  else {
    transformed.__children = [];
  }
  return transformed;
};

const transformData = (data: any[]) => data.map(transformRow);

function shortDateRenderer(
  instance: Handsontable.Core,
  td: HTMLTableCellElement,
  row: number,
  col: number,
  prop: string | number,
  value: any,
  cellProperties: Handsontable.CellProperties
) {
  let displayValue = 'X';

  if (typeof value === 'string' && value.length >= 10) {
    displayValue = value.substring(2, 10); // "YY-MM-DD"
  }


  Handsontable.renderers.TextRenderer.apply(
    this, [instance, td, row, col, prop, displayValue, cellProperties]
  );
}


const ExampleComponent = () => {

  // const hotTableRef = useRef(null);
  const [tableData, setTableData] = useState([]);
  const [costCenters, setCostCenters] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hotTableRef = useRef<HotTableRef>(null);
  // const hotTableComponentRef = useRef(null);

  const [isExpanded, setIsExpanded] = useState(true);
  const [isExpanded2, setIsExpanded2] = useState(true);
  const [renderTime, setRenderTime] = useState<number | null>(null);

  // colapsa la tabla no funciona :'v
  useEffect(() => {
    if (!isLoading && hotTableRef.current && tableData.length) {
      const hot = hotTableRef.current.hotInstance;
      const nestedRowsPlugin = hot.getPlugin('nestedRows');


      if (nestedRowsPlugin?.collapsingUI?.toggleRowExpansion) {
        // Despliega cada fila del nivel superior
        tableData.forEach((row, rowIndex) => {
          if (row.__children && row.__children.length > 0) {
            nestedRowsPlugin.collapsingUI.toggleRowExpansion(rowIndex, true);
          }
        });
      }
    }
  }, [isLoading, tableData]);

  // carga los datos
  useEffect(() => {
    const fetchData = async () => {
      try {
        // const response = await fetch('/data_dic_prod_inner.json');
        const response = await fetch('/data.json');
        // const response = await fetch('/data_DicEne_prod.json');
        console.log(response)
        if (!response.ok) throw new Error('Fallo al cargar los datos');

        const data = await response.json();

        const centers = gatherAllCostCenters(data);
        setCostCenters(centers);

        // Transforma los datos
        const transformed = transformData(data);
        setTableData(transformed);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // funcion que usa el boton para colapsar/comprimir
  const triggerBtnClickCallback = () => {
    setIsExpanded(!isExpanded);
  };

  //Colapsa toda la tabla
  useEffect(() => {
    const tableContainer = document.getElementById('tableContainer');
    if (!tableContainer) return;

    tableContainer.style.height = isExpanded ? '750px' : '5px';
    const hotInstance = hotTableRef.current?.hotInstance;
    if (hotInstance) {
      const start = performance.now();
      const onAfterRender = () => {
        const end = performance.now();
        setRenderTime(end - start);
        hotInstance.removeHook('afterRender', onAfterRender)
      }

      hotInstance.addHook('afterRender', onAfterRender);
      // hotTableRef.current?.hotInstance?.refreshDimensions();
      hotInstance.refreshDimensions();
    }
  }, [isExpanded]);

  // Efecto que se ejecuta cada vez que cambia el estado de expansión
  useEffect(() => {
    if (hotTableRef.current) {
      const hot = hotTableRef.current.hotInstance;
      const plugin = hot.getPlugin('NestedRows').collapsingUI;
      if (isExpanded2) {
        plugin.expandAll();
      } else {
        plugin.collapseAll();
      }
      // Forzar actualización visual de la tabla (opcional)
      hot.render();
    }
  }, [isExpanded2]);



  if (isLoading) return <div>Loading data...</div>;
  if (error) return <div>Error: {error}</div>;
  // console.log(tableData)

  const baseColumnasHeaders = [
    'Funcion',
    'Resultado',
    'Dim1',
    'Dim2',
    'Dim3',
    'Dim4',
    'Fecha Ref',
    'Fecha Venc',
  ]

  const baseColumna = [
    { data: 'funcion' },
    {
      data: 'resultadoFuncion',
      type: 'numeric',
      numericFormat: { pattern: '0,0.00' },
    },
    { data: 'dim1' },
    { data: 'dim2' },
    { data: 'dim3' },
    { data: 'dim4' },
    {
      data: 'fechaReferencia',
      renderer: shortDateRenderer,
    },
    {
      data: 'fechaVenc',
      renderer: shortDateRenderer,
    },
  ]



  // Por cada centro de costos crea una columna y muestra $ si hay un valor o 'X'
  const costCenterColHeaders = costCenters.map((cc) => cc);


  const costCenterColumns = costCenters.map((cc) => ({
    data: (rowData: any) => {
      if (!rowData || typeof rowData.level === 'undefined') {
        return 'X'; // or blank
      }
      if (rowData.level === 2) {

        console.log('Comparing:', rowData._centroCostos, 'vs', cc);
        return rowData._centroCostos === cc ? '$' : 'X';
      }
      return 'X';
    },
  }));

  const selectNivel1 = () => {

    if (hotTableRef.current !== null) {
      let hot = hotTableRef.current;
      let plu = hot.hotInstance.getPlugin('NestedRows').collapsingUI;
      console.log(plu);
      plu.collapseAll();
    }
  };

  const toggleTable = () => {
    setIsExpanded2((prev) => !prev);
  };

  const filterByCostCenter = (dim: 'dim1' | 'dim2' | 'dim3' | 'dim4' | null) => {
    const hot = hotTableRef.current?.hotInstance;
    if (!hot) return;

    const baseColumnsCount = baseColumna.length;
    const totalCostCenters = costCenterColHeaders.length;
    let hiddenColumns: number[] = [];

    if (dim !== null) {
      const blockSize = 7;
      let blockIndex = 0;
      if (dim === 'dim1') blockIndex = 0;
      else if (dim === 'dim2') blockIndex = 1;
      else if (dim === 'dim3') blockIndex = 2;
      else if (dim === 'dim4') blockIndex = 3;

      const startRelative = blockIndex * blockSize;

      const endRelative = (dim === 'dim4')
        ? totalCostCenters - 1
        : Math.min(startRelative + blockSize - 1, totalCostCenters - 1);

      // Oculta las columnas que no estén en el bloque calculado
      for (let i = 0; i < totalCostCenters; i++) {
        if (i < startRelative || i > endRelative) {
          // La columna real en Handsontable es la suma de las columnas base + el índice relativo
          hiddenColumns.push(baseColumnsCount + i);
        }
      }
    }
    hot.updateSettings({
      hiddenColumns: { columns: hiddenColumns },
    });
  }



  console.log(costCenterColHeaders) // returned an array with 28 elements
  console.log(costCenterColumns) // returned an array empty 28 index

  // Combinacion
  const allColHeaders = [...baseColumnasHeaders, ...costCenterColHeaders];
  const allColumns = [...baseColumna, ...costCenterColumns];

  return (
    <>
      <div className="controls">

        <button
          id="triggerBtn"
          onClick={toggleTable}
        >
          {isExpanded2 ? 'Colapsar' : 'Expandir'}
        </button>

        {renderTime !== null && (
          <div style={{ marginTop: '10px' }}>
            Rendering time: {renderTime.toFixed(2)} ms
          </div>
        )}
      </div>

      <div className="filter-controls" style={{ marginBottom: '10px' }}>
        <button onClick={() => filterByCostCenter('dim1')}>
          Dim1 (Comercial  y Logistico)
        </button>
        <button onClick={() => filterByCostCenter('dim2')}>
          Dim2 (Placa)
        </button>
        <button onClick={() => filterByCostCenter('dim3')}>
          Dim3 (Administrativos Finaciero)
        </button>
        <button onClick={() => filterByCostCenter('dim4')}>
          Dim4 (Unidad de Negocio)
        </button>
        <button onClick={() => filterByCostCenter(null)}>
          Limpiar filtro
        </button>
      </div>


      <div id="tableContainer" className='tableContainer' style={{ overflow: 'hidden' }}>

        <HotTable
          data={tableData}
          // stretchH='all'
          // colWidths={[3, 1, 1, 0.5, 1, 1, 1, 1]}
          nestedRows={true}
          colHeaders={
            allColHeaders
          }
          rowHeaders={true}
          // rowHeaders={(rowIndex: number) => {
          //   const hot = hotTableRef.current?.hotInstance;
          //   if (!hot) {

          //     return rowIndex + 1;
          //   }
          //   // Obtiene la fila 
          //   const rowData = hot.getSourceDataAtRow(rowIndex);

          //   // Si existe un indice personalizado (MyIndex) se muestra 
          //   if (rowData?.myIndex) {
          //     return rowData.myIndex;
          //   }
          //   return rowIndex + 1;
          // }}
          columns={
            allColumns
          }
          cells={(row, col) => {
            const hot = hotTableRef.current?.hotInstance;
            if (!hot) return {};

            const rowData: any = hot.getSourceDataAtRow(row);

            if (!rowData || typeof rowData.level === 'undefined') {
              return {};
            }

            const cellProps: any = {};

            if (rowData.level === 0) {
              cellProps.className = 'level-0';
            } else if (rowData.level === 1) {
              cellProps.className = 'level-1';
            }
            // else (level===2) => no style
            return cellProps;
          }}
          //afterSelectionEnd={selectNivel1}
          // Other standard settings
          contextMenu
          preventOverflow="horizontal"
          autoWrapRow={true}
          autoWrapCol={true}
          autoColumnSize
          manualColumnResize
          width="100%"
          // height="750px"
          height="auto"
          // rowHeights={20}
          // colWidths={100}
          licenseKey="non-commercial-and-evaluation"
          className="ht-theme-main"

          renderAllRows={false}
          // viewportColumnRenderingThreshold={12}
          viewportColumnRenderingOffset={12}
          viewportRowRenderingOffset={30}
          filters={true}
          dropdownMenu={true}
          hiddenColumns={{ columns: [] }}
          ref={hotTableRef}
        />
      </div>

    </>
  );

};

export default ExampleComponent;