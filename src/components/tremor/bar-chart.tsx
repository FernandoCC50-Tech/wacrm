// ============================================================
// Tremor BarChart [v1.0.0] — vendored from tremorlabs/tremor.
//
// Two local adaptations vs the upstream file:
//   1. `cx` (Tremor's `clsx`+`twMerge` helper) is replaced with
//      our own `cn` from `@/lib/utils`. Aliased locally so the
//      diff against upstream stays scoped to this `import` line.
//   2. The legend slider's arrow icons (`RiArrowLeftSLine` /
//      `RiArrowRightSLine` from `@remixicon/react`) are swapped
//      for `ChevronLeft` / `ChevronRight` from `lucide-react`,
//      which is already in the project's deps.
//
// Everything else — the chart logic, accessibility behaviour,
// tooltip / legend / slider implementation — is unchanged from
// the canonical Tremor Raw source.
//
// License: Apache 2.0 (Tremor).
// Source: https://github.com/tremorlabs/tremor/blob/main/src/components/BarChart/BarChart.tsx
// ============================================================

/* eslint-disable @typescript-eslint/no-explicit-any */

"use client"

import React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
  Bar,
  CartesianGrid,
  Rótulo,
  BarChart as RechartsBarChart,
  Legend as RechartsLegend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { AxisDomain } from "recharts/types/util/types"

import { cn as cx } from "@/lib/utils"
import {
  AvailableChartCors,
  type AvailableChartCorsKeys,
  constructCategoryCors,
  getCorClassNome,
} from "./chart-colors"
import { getYAxisDomain } from "./get-y-axis-domain"
import { useOnWindowResize } from "./use-on-window-resize"

//#region Shape

function deepEqual<T>(obj1: T, obj2: T): boolean {
  if (obj1 === obj2) return true

  if (
    typeof obj1 !== "object" ||
    typeof obj2 !== "object" ||
    obj1 === null ||
    obj2 === null
  ) {
    return false
  }

  const keys1 = Object.keys(obj1) as Array<keyof T>
  const keys2 = Object.keys(obj2) as Array<keyof T>

  if (keys1.length !== keys2.length) return false

  for (const key of keys1) {
    if (!keys2.includes(key) || !deepEqual(obj1[key], obj2[key])) return false
  }

  return true
}

const renderShape = (
  props: any,
  activeBar: any | undefined,
  activeLegend: string | undefined,
  layout: string,
) => {
  const { fillOpacity, name, payload, value } = props
  let { x, width, y, height } = props

  if (layout === "horizontal" && height < 0) {
    y += height
    height = Math.abs(height)
  } else if (layout === "vertical" && width < 0) {
    x += width
    width = Math.abs(width)
  }

  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      opacity={
        activeBar || (activeLegend && activeLegend !== name)
          ? deepEqual(activeBar, { ...payload, value })
            ? fillOpacity
            : 0.3
          : fillOpacity
      }
    />
  )
}

//#region Legend

interface LegendItemProps {
  name: string
  color: AvailableChartCorsKeys
  onClick?: (name: string, color: AvailableChartCorsKeys) => void
  activeLegend?: string
}

const LegendItem = ({
  name,
  color,
  onClick,
  activeLegend,
}: LegendItemProps) => {
  const hasOnValorChange = !!onClick
  return (
    <li
      classNome={cx(
        "group inline-flex flex-nowrap items-center gap-1.5 rounded-sm px-2 py-1 whitespace-nowrap transition",
        hasOnValorChange
          ? "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
          : "cursor-default",
      )}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(name, color)
      }}
    >
      <span
        classNome={cx(
          "size-2 shrink-0 rounded-xs",
          getCorClassNome(color, "bg"),
          activeLegend && activeLegend !== name ? "opacity-40" : "opacity-100",
        )}
        aria-hidden={true}
      />
      <p
        classNome={cx(
          "truncate text-xs whitespace-nowrap",
          "text-gray-700 dark:text-gray-300",
          hasOnValorChange &&
            "group-hover:text-gray-900 dark:group-hover:text-gray-50",
          activeLegend && activeLegend !== name ? "opacity-40" : "opacity-100",
        )}
      >
        {name}
      </p>
    </li>
  )
}

interface ScrollButtonProps {
  icon: React.ElementType
  onClick?: () => void
  disabled?: boolean
}

const ScrollButton = ({ icon, onClick, disabled }: ScrollButtonProps) => {
  const Icon = icon
  const [isPressed, setIsPressed] = React.useState(false)
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null)

  React.useEffect(() => {
    if (isPressed) {
      intervalRef.current = setInterval(() => {
        onClick?.()
      }, 300)
    } else {
      clearInterval(intervalRef.current as NodeJS.Timeout)
    }
    return () => clearInterval(intervalRef.current as NodeJS.Timeout)
  }, [isPressed, onClick])

  React.useEffect(() => {
    if (disabled) {
      clearInterval(intervalRef.current as NodeJS.Timeout)
      setIsPressed(false)
    }
  }, [disabled])

  return (
    <button
      type="button"
      classNome={cx(
        "group inline-flex size-5 items-center truncate rounded-sm transition",
        disabled
          ? "cursor-not-allowed text-gray-400 dark:text-gray-600"
          : "cursor-pointer text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-50",
      )}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      onMouseDown={(e) => {
        e.stopPropagation()
        setIsPressed(true)
      }}
      onMouseUp={(e) => {
        e.stopPropagation()
        setIsPressed(false)
      }}
    >
      <Icon classNome="size-full" aria-hidden="true" />
    </button>
  )
}

interface LegendProps extends React.OlHTMLAttributes<HTMLOListElement> {
  categories: string[]
  colors?: AvailableChartCorsKeys[]
  onClickLegendItem?: (category: string, color: string) => void
  activeLegend?: string
  enableLegendSlider?: boolean
}

type HasScrollProps = {
  left: boolean
  right: boolean
}

const Legend = React.forwardRef<HTMLOListElement, LegendProps>((props, ref) => {
  const {
    categories,
    colors = AvailableChartCors,
    classNome,
    onClickLegendItem,
    activeLegend,
    enableLegendSlider = false,
    ...other
  } = props
  const scrollableRef = React.useRef<HTMLInputElement>(null)
  const scrollButtonsRef = React.useRef<HTMLDivElement>(null)
  const [hasScroll, setHasScroll] = React.useState<HasScrollProps | null>(null)
  const [isKeyDowned, setIsKeyDowned] = React.useState<string | null>(null)
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null)

  const checkScroll = React.useCallback(() => {
    const scrollable = scrollableRef?.current
    if (!scrollable) return

    const hasLeftScroll = scrollable.scrollLeft > 0
    const hasRightScroll =
      scrollable.scrollWidth - scrollable.clientWidth > scrollable.scrollLeft

    setHasScroll({ left: hasLeftScroll, right: hasRightScroll })
  }, [setHasScroll])

  const scrollToTest = React.useCallback(
    (direction: "left" | "right") => {
      const element = scrollableRef?.current
      const scrollButtons = scrollButtonsRef?.current
      const scrollButtonsWith = scrollButtons?.clientWidth ?? 0
      const width = element?.clientWidth ?? 0

      if (element && enableLegendSlider) {
        element.scrollTo({
          left:
            direction === "left"
              ? element.scrollLeft - width + scrollButtonsWith
              : element.scrollLeft + width - scrollButtonsWith,
          behavior: "smooth",
        })
        setTimeout(() => {
          checkScroll()
        }, 400)
      }
    },
    [enableLegendSlider, checkScroll],
  )

  React.useEffect(() => {
    const keyDownHandler = (key: string) => {
      if (key === "ArrowLeft") {
        scrollToTest("left")
      } else if (key === "ArrowRight") {
        scrollToTest("right")
      }
    }
    if (isKeyDowned) {
      keyDownHandler(isKeyDowned)
      intervalRef.current = setInterval(() => {
        keyDownHandler(isKeyDowned)
      }, 300)
    } else {
      clearInterval(intervalRef.current as NodeJS.Timeout)
    }
    return () => clearInterval(intervalRef.current as NodeJS.Timeout)
  }, [isKeyDowned, scrollToTest])

  const keyDown = (e: KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault()
      setIsKeyDowned(e.key)
    }
  }
  const keyUp = (e: KeyboardEvent) => {
    e.stopPropagation()
    setIsKeyDowned(null)
  }

  React.useEffect(() => {
    const scrollable = scrollableRef?.current
    if (enableLegendSlider) {
      checkScroll()
      scrollable?.addEventListener("keydown", keyDown)
      scrollable?.addEventListener("keyup", keyUp)
    }

    return () => {
      scrollable?.removeEventListener("keydown", keyDown)
      scrollable?.removeEventListener("keyup", keyUp)
    }
  }, [checkScroll, enableLegendSlider])

  return (
    <ol
      ref={ref}
      classNome={cx("relative overflow-hidden", classNome)}
      {...other}
    >
      <div
        ref={scrollableRef}
        tabIndex={0}
        classNome={cx(
          "flex h-full",
          enableLegendSlider
            ? hasScroll?.right || hasScroll?.left
              ? "snap-mandatory items-center overflow-auto pr-12 pl-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              : ""
            : "flex-wrap",
        )}
      >
        {categories.map((category, index) => (
          <LegendItem
            key={`item-${index}`}
            name={category}
            color={colors[index] as AvailableChartCorsKeys}
            onClick={onClickLegendItem}
            activeLegend={activeLegend}
          />
        ))}
      </div>
      {enableLegendSlider && (hasScroll?.right || hasScroll?.left) ? (
        <>
          <div
            ref={scrollButtonsRef}
            classNome={cx(
              "absolute top-0 right-0 bottom-0 flex h-full items-center justify-center pr-1",
              "bg-white dark:bg-gray-950",
            )}
          >
            <ScrollButton
              icon={ChevronLeft}
              onClick={() => {
                setIsKeyDowned(null)
                scrollToTest("left")
              }}
              disabled={!hasScroll?.left}
            />
            <ScrollButton
              icon={ChevronRight}
              onClick={() => {
                setIsKeyDowned(null)
                scrollToTest("right")
              }}
              disabled={!hasScroll?.right}
            />
          </div>
        </>
      ) : null}
    </ol>
  )
})

Legend.displayNome = "Legend"

const ChartLegend = (
  { payload }: any,
  categoryCors: Map<string, AvailableChartCorsKeys>,
  setLegendHeight: React.Dispatch<React.SetStateAção<number>>,
  activeLegend: string | undefined,
  onClick?: (category: string, color: string) => void,
  enableLegendSlider?: boolean,
  legendPosition?: "left" | "center" | "right",
  yAxisWidth?: number,
) => {
  const legendRef = React.useRef<HTMLDivElement>(null)

  useOnWindowResize(() => {
    const calculateHeight = (height: number | undefined) =>
      height ? Number(height) + 15 : 60
    setLegendHeight(calculateHeight(legendRef.current?.clientHeight))
  })

  const filteredPayload = payload.filter((item: any) => item.type !== "none")

  const paddingLeft =
    legendPosition === "left" && yAxisWidth ? yAxisWidth - 8 : 0

  return (
    <div
      style={{ paddingLeft: paddingLeft }}
      ref={legendRef}
      classNome={cx(
        "flex items-center",
        { "justify-center": legendPosition === "center" },
        {
          "justify-start": legendPosition === "left",
        },
        { "justify-end": legendPosition === "right" },
      )}
    >
      <Legend
        categories={filteredPayload.map((entry: any) => entry.value)}
        colors={filteredPayload.map((entry: any) =>
          categoryCors.get(entry.value),
        )}
        onClickLegendItem={onClick}
        activeLegend={activeLegend}
        enableLegendSlider={enableLegendSlider}
      />
    </div>
  )
}

//#region Tooltip

type TooltipProps = Pick<ChartTooltipProps, "active" | "payload" | "label">

type PayloadItem = {
  category: string
  value: number
  index: string
  color: AvailableChartCorsKeys
  type?: string
  payload: any
}

interface ChartTooltipProps {
  active: boolean | undefined
  payload: PayloadItem[]
  // Recharts 3.x widened this from `string` to `string | number | undefined`.
  // Tremor's source (written against recharts ^2.13.3) still types it as
  // `string`; we widen here so the vendored file typechecks against the
  // current recharts release without forcing a downgrade.
  label: string | number | undefined
  valueFormatter: (value: number) => string
}

const ChartTooltip = ({
  active,
  payload,
  label,
  valueFormatter,
}: ChartTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div
        classNome={cx(
          "rounded-md border text-sm shadow-md",
          "border-gray-200 dark:border-gray-800",
          "bg-white dark:bg-gray-950",
        )}
      >
        <div classNome={cx("border-b border-inherit px-4 py-2")}>
          <p
            classNome={cx("font-medium", "text-gray-900 dark:text-gray-50")}
          >
            {label}
          </p>
        </div>
        <div classNome={cx("space-y-1 px-4 py-2")}>
          {payload.map(({ value, category, color }, index) => (
            <div
              key={`id-${index}`}
              classNome="flex items-center justify-between space-x-8"
            >
              <div classNome="flex items-center space-x-2">
                <span
                  aria-hidden="true"
                  classNome={cx(
                    "size-2 shrink-0 rounded-xs",
                    getCorClassNome(color, "bg"),
                  )}
                />
                <p
                  classNome={cx(
                    "text-right whitespace-nowrap",
                    "text-gray-700 dark:text-gray-300",
                  )}
                >
                  {category}
                </p>
              </div>
              <p
                classNome={cx(
                  "text-right font-medium whitespace-nowrap tabular-nums",
                  "text-gray-900 dark:text-gray-50",
                )}
              >
                {valueFormatter(value)}
              </p>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

//#region BarChart

type BaseEventProps = {
  eventType: "category" | "bar"
  categoryClicked: string
  [key: string]: number | string
}

type BarChartEventProps = BaseEventProps | null | undefined

interface BarChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: Record<string, any>[]
  index: string
  categories: string[]
  colors?: AvailableChartCorsKeys[]
  valueFormatter?: (value: number) => string
  startEndOnly?: boolean
  showXAxis?: boolean
  showYAxis?: boolean
  showGridLines?: boolean
  yAxisWidth?: number
  intervalType?: "preserveStartEnd" | "equidistantPreserveStart"
  showTooltip?: boolean
  showLegend?: boolean
  autoMinValor?: boolean
  minValor?: number
  maxValor?: number
  allowDecimals?: boolean
  onValorChange?: (value: BarChartEventProps) => void
  enableLegendSlider?: boolean
  tickGap?: number
  barCategoryGap?: string | number
  xAxisRótulo?: string
  yAxisRótulo?: string
  layout?: "vertical" | "horizontal"
  type?: "default" | "stacked" | "percent"
  legendPosition?: "left" | "center" | "right"
  tooltipCallback?: (tooltipCallbackContent: TooltipProps) => void
  customTooltip?: React.ComponentType<TooltipProps>
}

const BarChart = React.forwardRef<HTMLDivElement, BarChartProps>(
  (props, forwardedRef) => {
    const {
      data = [],
      categories = [],
      index,
      colors = AvailableChartCors,
      valueFormatter = (value: number) => value.toString(),
      startEndOnly = false,
      showXAxis = true,
      showYAxis = true,
      showGridLines = true,
      yAxisWidth = 56,
      intervalType = "equidistantPreserveStart",
      showTooltip = true,
      showLegend = true,
      autoMinValor = false,
      minValor,
      maxValor,
      allowDecimals = true,
      classNome,
      onValorChange,
      enableLegendSlider = false,
      barCategoryGap,
      tickGap = 5,
      xAxisRótulo,
      yAxisRótulo,
      layout = "horizontal",
      type = "default",
      legendPosition = "right",
      tooltipCallback,
      customTooltip,
      ...other
    } = props
    const CustomTooltip = customTooltip
    const paddingValor =
      (!showXAxis && !showYAxis) || (startEndOnly && !showYAxis) ? 0 : 20
    const [legendHeight, setLegendHeight] = React.useState(60)
    const [activeLegend, setAtivoLegend] = React.useState<string | undefined>(
      undefined,
    )
    const categoryCors = constructCategoryCors(categories, colors)
    const [activeBar, setAtivoBar] = React.useState<any | undefined>(undefined)
    const yAxisDomain = getYAxisDomain(autoMinValor, minValor, maxValor)
    const hasOnValorChange = !!onValorChange
    const stacked = type === "stacked" || type === "percent"

    const prevAtivoRef = React.useRef<boolean | undefined>(undefined)
    // Widened from `string | undefined` to match the recharts 3.x
    // `label` type (see the ChartTooltipProps note below).
    const prevRótuloRef = React.useRef<string | number | undefined>(undefined)

    function valueToPercent(value: number) {
      return `${(value * 100).toFixed(0)}%`
    }

    function onBarClick(data: any, _: any, event: React.MouseEvent) {
      event.stopPropagation()
      if (!onValorChange) return
      if (deepEqual(activeBar, { ...data.payload, value: data.value })) {
        setAtivoLegend(undefined)
        setAtivoBar(undefined)
        onValorChange?.(null)
      } else {
        setAtivoLegend(data.tooltipPayload?.[0]?.dataKey)
        setAtivoBar({
          ...data.payload,
          value: data.value,
        })
        onValorChange?.({
          eventType: "bar",
          categoryClicked: data.tooltipPayload?.[0]?.dataKey,
          ...data.payload,
        })
      }
    }

    function onCategoryClick(dataKey: string) {
      if (!hasOnValorChange) return
      if (dataKey === activeLegend && !activeBar) {
        setAtivoLegend(undefined)
        onValorChange?.(null)
      } else {
        setAtivoLegend(dataKey)
        onValorChange?.({
          eventType: "category",
          categoryClicked: dataKey,
        })
      }
      setAtivoBar(undefined)
    }

    return (
      <div
        ref={forwardedRef}
        classNome={cx("h-80 w-full", classNome)}
        tremor-id="tremor-raw"
        {...other}
      >
        <ResponsiveContainer>
          <RechartsBarChart
            data={data}
            onClick={
              hasOnValorChange && (activeLegend || activeBar)
                ? () => {
                    setAtivoBar(undefined)
                    setAtivoLegend(undefined)
                    onValorChange?.(null)
                  }
                : undefined
            }
            margin={{
              bottom: xAxisRótulo ? 30 : undefined,
              left: yAxisRótulo ? 20 : undefined,
              right: yAxisRótulo ? 5 : undefined,
              top: 5,
            }}
            stackOffset={type === "percent" ? "expand" : undefined}
            layout={layout}
            barCategoryGap={barCategoryGap}
          >
            {showGridLines ? (
              <CartesianGrid
                classNome={cx("stroke-gray-200 stroke-1 dark:stroke-gray-800")}
                horizontal={layout !== "vertical"}
                vertical={layout === "vertical"}
              />
            ) : null}
            <XAxis
              hide={!showXAxis}
              tick={{
                transform:
                  layout !== "vertical" ? "translate(0, 6)" : undefined,
              }}
              fill=""
              stroke=""
              classNome={cx(
                "text-xs",
                "fill-gray-500 dark:fill-gray-500",
                { "mt-4": layout !== "vertical" },
              )}
              tickLine={false}
              axisLine={false}
              minTickGap={tickGap}
              {...(layout !== "vertical"
                ? {
                    padding: {
                      left: paddingValor,
                      right: paddingValor,
                    },
                    dataKey: index,
                    interval: startEndOnly ? "preserveStartEnd" : intervalType,
                    ticks: startEndOnly
                      ? [data[0][index], data[data.length - 1][index]]
                      : undefined,
                  }
                : {
                    type: "number",
                    domain: yAxisDomain as AxisDomain,
                    tickFormatter:
                      type === "percent" ? valueToPercent : valueFormatter,
                    allowDecimals: allowDecimals,
                  })}
            >
              {xAxisRótulo && (
                <Rótulo
                  position="insideBottom"
                  offset={-20}
                  classNome="fill-gray-800 text-sm font-medium dark:fill-gray-200"
                >
                  {xAxisRótulo}
                </Rótulo>
              )}
            </XAxis>
            <YAxis
              width={yAxisWidth}
              hide={!showYAxis}
              axisLine={false}
              tickLine={false}
              fill=""
              stroke=""
              classNome={cx(
                "text-xs",
                "fill-gray-500 dark:fill-gray-500",
              )}
              tick={{
                transform:
                  layout !== "vertical"
                    ? "translate(-3, 0)"
                    : "translate(0, 0)",
              }}
              {...(layout !== "vertical"
                ? {
                    type: "number",
                    domain: yAxisDomain as AxisDomain,
                    tickFormatter:
                      type === "percent" ? valueToPercent : valueFormatter,
                    allowDecimals: allowDecimals,
                  }
                : {
                    dataKey: index,
                    ticks: startEndOnly
                      ? [data[0][index], data[data.length - 1][index]]
                      : undefined,
                    type: "category",
                    interval: "equidistantPreserveStart",
                  })}
            >
              {yAxisRótulo && (
                <Rótulo
                  position="insideLeft"
                  style={{ textAnchor: "middle" }}
                  angle={-90}
                  offset={-15}
                  classNome="fill-gray-800 text-sm font-medium dark:fill-gray-200"
                >
                  {yAxisRótulo}
                </Rótulo>
              )}
            </YAxis>
            <Tooltip
              wrapperStyle={{ outline: "none" }}
              isAnimationAtivo={true}
              animationDuration={100}
              cursor={{ fill: "#d1d5db", opacity: "0.15" }}
              offset={20}
              position={{
                y: layout === "horizontal" ? 0 : undefined,
                x: layout === "horizontal" ? undefined : yAxisWidth + 20,
              }}
              content={({ active, payload, label }) => {
                const cleanPayload: TooltipProps["payload"] = payload
                  ? payload.map((item: any) => ({
                      category: item.dataKey,
                      value: item.value,
                      index: item.payload[index],
                      color: categoryCors.get(
                        item.dataKey,
                      ) as AvailableChartCorsKeys,
                      type: item.type,
                      payload: item.payload,
                    }))
                  : []

                if (
                  tooltipCallback &&
                  (active !== prevAtivoRef.current ||
                    label !== prevRótuloRef.current)
                ) {
                  tooltipCallback({ active, payload: cleanPayload, label })
                  prevAtivoRef.current = active
                  prevRótuloRef.current = label
                }

                return showTooltip && active ? (
                  CustomTooltip ? (
                    <CustomTooltip
                      active={active}
                      payload={cleanPayload}
                      label={label}
                    />
                  ) : (
                    <ChartTooltip
                      active={active}
                      payload={cleanPayload}
                      label={label}
                      valueFormatter={valueFormatter}
                    />
                  )
                ) : null
              }}
            />
            {showLegend ? (
              <RechartsLegend
                verticalAlign="top"
                height={legendHeight}
                content={({ payload }) =>
                  ChartLegend(
                    { payload },
                    categoryCors,
                    setLegendHeight,
                    activeLegend,
                    hasOnValorChange
                      ? (clickedLegendItem: string) =>
                          onCategoryClick(clickedLegendItem)
                      : undefined,
                    enableLegendSlider,
                    legendPosition,
                    yAxisWidth,
                  )
                }
              />
            ) : null}
            {categories.map((category) => (
              <Bar
                classNome={cx(
                  getCorClassNome(
                    categoryCors.get(category) as AvailableChartCorsKeys,
                    "fill",
                  ),
                  onValorChange ? "cursor-pointer" : "",
                )}
                key={category}
                name={category}
                type="linear"
                dataKey={category}
                stackId={stacked ? "stack" : undefined}
                isAnimationAtivo={false}
                fill=""
                shape={(props: any) =>
                  renderShape(props, activeBar, activeLegend, layout)
                }
                onClick={onBarClick}
              />
            ))}
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>
    )
  },
)

BarChart.displayNome = "BarChart"

export { BarChart, type BarChartEventProps, type BarChartProps, type TooltipProps }
