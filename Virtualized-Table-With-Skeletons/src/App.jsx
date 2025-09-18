import React, { useEffect, useState, useRef, useMemo } from "react";

const TOTAL_ROWS = 10000;      // full dataset size (virtual)
const ROW_HEIGHT = 40;
const VIEWPORT_HEIGHT = 600;
const BATCH_SIZE = 200;        // how many rows we fetch per batch
const PREFETCH_THRESHOLD = 20; // rows before batch start to prefetch

export default function App() {
  const [data, setData] = useState([]); // sparse array: items placed at their absolute index
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [scrollTop, setScrollTop] = useState(0);

  const [filter, setFilter] = useState(""); // filter text
  const [sortConfig, setSortConfig] = useState({ key: "id", direction: "asc" });

  const containerRef = useRef(null);

  // initial batch
  useEffect(() => {
    fetchBatch(0, TOTAL_ROWS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // fetch a batch and place rows directly at their absolute indexes
  const fetchBatch = (startIndex, count) => {
    if (loading) return;
    setLoading(true);

    setTimeout(() => {
      const newRows = Array.from({ length: count }, (_, i) => {
        const id = startIndex + i + 1;
        return { id, name: `User ${id}`, email: `user${id}@example.com` };
      });

      setData((prev) => {
        const copy = prev.slice(); // keep sparse structure
        newRows.forEach((row, i) => {
          copy[startIndex + i] = row;
        });
        return copy;
      });

      setLoading(false);

      if (startIndex + count >= TOTAL_ROWS) setHasMore(false);
    }, 2000); // simulated 2s delay
  };

  // Derived: list of loaded rows (compact)
  const loadedRows = useMemo(() => data.filter(Boolean), [data]);

  // Apply filter + sort on loaded rows (we only filter/sort loaded rows client-side)
  const processedData = useMemo(() => {
    let arr = loadedRows.slice();

    if (filter.trim()) {
      const q = filter.toLowerCase();
      arr = arr.filter(
        (r) => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)
      );
    }

    if (sortConfig.key) {
      arr.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return arr;
  }, [loadedRows, filter, sortConfig]);

  // Are we in filtered-mode?
  const isFiltering = filter.trim().length > 0;

  // Virtualization math depends on whether we're filtering or not
  const visibleCount = Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT) + 5;
  const absoluteStart = Math.floor(scrollTop / ROW_HEIGHT);

  // When filtering, totalRows is number of processed matches
  const totalRows = isFiltering ? processedData.length : TOTAL_ROWS;

  // constrain start so it's never past the end
  const startIndex = Math.min(absoluteStart, Math.max(0, totalRows - visibleCount));
  const endIndex = Math.min(totalRows, startIndex + visibleCount);

  // handle scroll: prefetch next batch when within PREFETCH_THRESHOLD of next batch start (only when not filtering)
  const handleScroll = (e) => {
    const st = e.currentTarget.scrollTop;
    setScrollTop(st);
    if (isFiltering) return; // don't trigger batch prefetch in filtered mode

    const currentRow = Math.floor(st / ROW_HEIGHT);

    if (hasMore && !loading) {
      const nextBatchStart =
        Math.floor(currentRow / BATCH_SIZE) * BATCH_SIZE + BATCH_SIZE;
      if (
        nextBatchStart < TOTAL_ROWS &&
        nextBatchStart - currentRow <= PREFETCH_THRESHOLD &&
        !data[nextBatchStart]
      ) {
        fetchBatch(nextBatchStart, BATCH_SIZE);
      }
    }
  };

  // Build visible rows depending on mode
  const visibleRows = [];
  if (isFiltering) {
    // use processedData slice (packed)
    const slice = processedData.slice(startIndex, endIndex);
    if (slice.length === 0) {
      visibleRows.push(
        <tr key="no-results" style={{ height: ROW_HEIGHT }}>
          <td colSpan={3} style={{ padding: 8 }}>
            No results
          </td>
        </tr>
      );
    } else {
      slice.forEach((row) => {
        visibleRows.push(
          <tr key={row.id} style={{ height: ROW_HEIGHT }}>
            <td style={tdStyle}>{row.id}</td>
            <td style={tdStyle}>{row.name}</td>
            <td style={tdStyle}>{row.email}</td>
          </tr>
        );
      });
    }
  } else {
    // normal mode: absolute indexing into sparse `data` array, render skeletons for holes
    for (let i = startIndex; i < endIndex; i++) {
      const row = data[i];
      if (row) {
        visibleRows.push(
          <tr key={i} style={{ height: ROW_HEIGHT }}>
            <td style={tdStyle}>{row.id}</td>
            <td style={tdStyle}>{row.name}</td>
            <td style={tdStyle}>{row.email}</td>
          </tr>
        );
      } else {
        visibleRows.push(
          <tr key={`s-${i}`} style={{ height: ROW_HEIGHT }}>
            <td style={tdStyle}><div style={skeletonStyle(40)} /></td>
            <td style={tdStyle}><div style={skeletonStyle(120)} /></td>
            <td style={tdStyle}><div style={skeletonStyle(200)} /></td>
          </tr>
        );
      }
    }
  }

  // toggle sort
 const toggleSort = (key) => {
  setSortConfig((prev) => {
    const direction = prev.key === key && prev.direction === "asc" ? "desc" : "asc";
    return { key, direction };
  });

  setData((prev) => {
    const copy = prev.slice(); // shallow copy
    copy.sort((a, b) => {
      if (!a || !b) return 0; // skip empty slots in sparse array

      const aVal = a[key];
      const bVal = b[key];

      // number comparison
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      // string comparison
      return sortConfig.direction === "asc"
        ? aVal.toString().localeCompare(bVal.toString())
        : bVal.toString().localeCompare(aVal.toString());
    });
    return copy;
  });
};


  // spacer heights
  const spacerTop = startIndex * ROW_HEIGHT;
  const spacerBottom = (totalRows - endIndex) * ROW_HEIGHT;

  return (
    <div style={{
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",  // vertical centering
  alignItems: "center",      // horizontal centering
  minHeight: "100vh",        // full viewport height
  width: "100vw",         // full viewport width
  padding: 20,
  boxSizing: "border-box"
}}>

      <h2>Virtualized Batch Table — Filter & Sort (fixed)</h2>

      <div style={{ marginBottom: 8, display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            // reset scroll so user sees top of filtered results
            if (containerRef.current) containerRef.current.scrollTop = 0;
            setScrollTop(0);
          }}
          placeholder="Filter by name or email (search loaded rows)..."
          style={{ padding: 8, width: 320 }}
        />

        <div style={{ color: "#666" }}>
          Loaded: {loadedRows.length} rows
          {isFiltering ? ` • Showing ${processedData.length} matches` : ""}
        </div>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
           height: VIEWPORT_HEIGHT,
      overflowY: "auto",
      border: "1px solid #ccc",
      minWidth: "50vw",  // table width relative to parent
        }}
      >
        <table  style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ height: ROW_HEIGHT, background: "#fafafa" }}>
              <th style={thStyle} onClick={() => toggleSort("id")}>ID {sortIndicator("id", sortConfig)}</th>
              <th style={thStyle} onClick={() => toggleSort("name")}>Name {sortIndicator("name", sortConfig)}</th>
              <th style={thStyle} onClick={() => toggleSort("email")}>Email {sortIndicator("email", sortConfig)}</th>
            </tr>
          </thead>
          <tbody>
            {/* spacer above */}
            <tr style={{ height: spacerTop }} />

            {visibleRows}

            {/* spacer below */}
            <tr style={{ height: spacerBottom }} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* --- styles & helpers --- */

const thStyle = {
  borderBottom: "1px solid #ddd",
  textAlign: "left",
  padding: "8px",
  cursor: "pointer",
  userSelect: "none",
  position: "sticky",
  top: 0,                 // stick to top of scroll container
  background: "#fafafa",  // same as your existing header bg
  zIndex: 2,              // make sure it stays above rows
};


const tdStyle = {
  padding: "6px 8px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

function skeletonStyle(width) {
  return {
    width,
    height: 14,
    backgroundColor: "#e9e9e9",
    borderRadius: 4,
    animation: "pulse 1.4s infinite",
  };
}

function sortIndicator(col, config) {
  if (config.key !== col) return "";
  return config.direction === "asc" ? "▲" : "▼";
}

/* inject pulse animation */
const style = document.createElement("style");
style.innerHTML = `
@keyframes pulse { 0%{opacity:1} 50%{opacity:.45} 100%{opacity:1} }
`;
document.head.appendChild(style);
