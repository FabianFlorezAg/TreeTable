import { useRef, useState, useEffect } from 'react';
import { HotTable, HotTableRef } from '@handsontable/react-wrapper';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/styles/handsontable.css';
import 'handsontable/styles/ht-theme-main.css';

// Register all Handsontable modules (includes Nested Headers & Collapsible Columns)
registerAllModules();

// Helper function to convert an index to an Excel-like column letter (A, B, C, …)
const toColumnName = (num: number): string => {
  let name = '';
  while (num >= 0) {
    name = String.fromCharCode((num % 26) + 65) + name;
    num = Math.floor(num / 26) - 1;
  }
  return name;
};

// Generate an array of arrays with dummy data (50 rows x 50 columns)
const data = new Array(1000)
  .fill(null)
  .map((_, row) =>
    new Array(1000)
      .fill(null)
      .map((_, col) => `${row}, ${col}`)
  );

const TableTest = () => {
  const [isContainerExpanded, setIsContainerExpanded] = useState(true);
  const [renderTime, setRenderTime] = useState<number | null>(null);
  const hotRef = useRef<HotTableRef>(null);

  const triggerBtnClickCallback = () => {
    setIsContainerExpanded(!isContainerExpanded);
  };

  useEffect(() => {
    const parent = document.getElementById('exampleParent');
    if (!parent) return;

    parent.style.height = isContainerExpanded ? '750px' : '0px';
    const hotInstance = hotRef.current?.hotInstance;
    if (hotInstance) {
      const start = performance.now();
      const onAfterRender = () => {
        const end = performance.now();
        setRenderTime(end - start);
        hotInstance.removeHook('afterRender', onAfterRender);
      };
      hotInstance.addHook('afterRender', onAfterRender);
      hotInstance.refreshDimensions();
    }
  }, [isContainerExpanded]);

  // Create a header row with Excel-style letters for each column.
  const headerRow = Array.from({ length: 50 }, (_, col) => toColumnName(col));

  const filterByColumnGroup = (groupIndex: number | null) => {
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;

    let hiddenColumns = [];
    // "Other Columns" span columns 5 to 49.
    if (groupIndex !== null) {
      const start = 5 + groupIndex * 9; // starting column for the selected block
      const end = start + 9 - 1; // ending column for the selected block
      // Hide all columns in "Other Columns" except those in the [start, end] block.
      for (let i = 5; i <= 49; i++) {
        if (i < start || i > end) {
          hiddenColumns.push(i);
        }
      }
    }
    hot.updateSettings({
      hiddenColumns: { columns: hiddenColumns },
    });
  };

  return (
    <>
      <div className="controls">
        <button
          id="triggerBtn"
          className="button button--primary"
          onClick={triggerBtnClickCallback}
        >
          {isContainerExpanded ? 'Collapse container' : 'Expand container'}
        </button>
        {renderTime !== null && (
          <div style={{ marginTop: '10px' }}>
            Rendering time: {renderTime.toFixed(2)} ms
          </div>
        )}
      </div>
      <div className="filter-controls" style={{ marginBottom: '10px' }}>
        {/* Buttons for filtering by nested column group */}
        <button onClick={() => filterByColumnGroup(0)}>Filter A (F–N)</button>
        <button onClick={() => filterByColumnGroup(1)}>Filter B (O–W)</button>
        <button onClick={() => filterByColumnGroup(2)}>Filter C (X–AF)</button>
        <button onClick={() => filterByColumnGroup(3)}>Filter D (AG–AO)</button>
        <button onClick={() => filterByColumnGroup(4)}>Filter E (AP–AX)</button>
        <button onClick={() => filterByColumnGroup(null)}>Clear Column Filter</button>
      </div>
      <div id="exampleParent" className="exampleParent">
        <HotTable
          data={data}
          rowHeaders={true}           // Keep row indices visible.
          colHeaders={false}          // Using nested headers instead.
          width="100%"
          height="100%"
          rowHeights={23}
          colWidths={100}
          viewportColumnRenderingThreshold={12}
          viewportRowRenderingThreshold={30}
          licenseKey="non-commercial-and-evaluation"         
          nestedHeaders={[
            [
              { label: 'First 5 Columns', colspan: 5 },
              { label: 'Other Columns', colspan: 45 },
            ],
            headerRow,
          ]}         
          collapsibleColumns={[
            { row: -2, col: 0, collapsible: true },  // Collapse control for "First 5 Columns"
            { row: -2, col: 5, collapsible: true },  // Collapse control for "Other Columns"
          ]}
          className="ht-theme-main"
          filters={true}
          dropdownMenu={true}
          hiddenColumns={{ columns: [] }}
          ref={hotRef}
        />
      </div>
    </>
  );
};

export default TableTest;
