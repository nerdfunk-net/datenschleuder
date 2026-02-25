"use client"

import React, { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckProcessGroupJobResult, CheckProcessGroupChild } from "../../types/job-results"
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Layers,
  GitBranch,
} from "lucide-react"

interface CheckProcessGroupResultViewProps {
  result: CheckProcessGroupJobResult
}

function PassBadge({ passed }: { passed: boolean }) {
  return passed ? (
    <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
      PASSED
    </Badge>
  ) : (
    <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
      FAILED
    </Badge>
  )
}

function CounterGrid({ counters }: { counters: CheckProcessGroupJobResult["counters"] }) {
  const items = [
    { label: "Running", value: counters.running_count, color: "green" },
    { label: "Stopped", value: counters.stopped_count, color: "yellow" },
    { label: "Disabled", value: counters.disabled_count, color: "gray" },
    { label: "Stale", value: counters.stale_count, color: "orange" },
  ] as const

  const colorMap: Record<string, string> = {
    green: "bg-green-50 border-green-200 text-green-700",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
    gray: "bg-gray-50 border-gray-200 text-gray-700",
    orange: "bg-orange-50 border-orange-200 text-orange-700",
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map(({ label, value, color }) => (
        <div
          key={label}
          className={`flex flex-col items-center p-3 border rounded-lg ${colorMap[color]}`}
        >
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  )
}

function ViolationsList({ violations }: { violations: string[] }) {
  if (violations.length === 0) return null

  const labelMap: Record<string, string> = {
    running_count: "running",
    stopped_count: "stopped",
    disabled_count: "disabled",
    stale_count: "stale",
  }

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {violations.map((v) => (
        <Badge key={v} variant="outline" className="bg-red-50 border-red-300 text-red-700 text-xs">
          {labelMap[v] ?? v} &gt; 0
        </Badge>
      ))}
    </div>
  )
}

function ChildRow({ child }: { child: CheckProcessGroupChild }) {
  const [open, setOpen] = useState(!child.passed)

  return (
    <div className={`border rounded-lg ${child.passed ? "" : "border-red-200"}`}>
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/40 transition-colors rounded-lg"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          {child.passed ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0 text-red-600" />
          )}
          <span className="font-medium text-sm truncate">{child.name}</span>
          {child.error && (
            <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 text-xs">
              Error
            </Badge>
          )}
        </div>
        <PassBadge passed={child.passed} />
      </button>

      {open && (
        <div className="px-4 pb-3 pt-1">
          {child.error ? (
            <p className="text-sm text-red-600">{child.error}</p>
          ) : child.counters ? (
            <>
              <CounterGrid counters={child.counters} />
              <ViolationsList violations={child.violations ?? []} />
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

export function CheckProcessGroupResultView({ result }: CheckProcessGroupResultViewProps) {
  const children: CheckProcessGroupChild[] = result.children ?? []
  const hasChildren = children.length > 0
  const [childrenOpen, setChildrenOpen] = useState(!result.passed)

  return (
    <div className="space-y-4">
      {/* ── Header summary card ── */}
      <Card className={result.passed ? "" : "border-red-300"}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              <span>Check ProcessGroup</span>
            </div>
            <div className="flex items-center gap-2">
              {result.passed ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              <PassBadge passed={result.passed} />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Meta row */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <span>
              Instance:{" "}
              <strong className="text-foreground">{result.instance_name}</strong>
            </span>
            <span>
              Process group:{" "}
              <strong className="text-foreground">
                {result.process_group_name ?? result.process_group_id}
              </strong>
            </span>
            {result.process_group_path && (
              <span className="text-xs italic">{result.process_group_path}</span>
            )}
            <span>
              Expected:{" "}
              <Badge variant="outline" className="text-xs font-semibold">
                {result.expected_status}
              </Badge>
            </span>
          </div>

          {/* Counters */}
          <CounterGrid counters={result.counters} />

          {/* Violations */}
          {result.violations.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Constraint violations (non-zero when they should be 0):
              </p>
              <ViolationsList violations={result.violations} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Children section ── */}
      {hasChildren && (
        <Card>
          <CardHeader
            className="cursor-pointer select-none py-3"
            onClick={() => setChildrenOpen((v) => !v)}
          >
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                {childrenOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <GitBranch className="h-4 w-4" />
                Child Process Groups
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-normal text-muted-foreground">
                  {children.filter((c) => !c.passed).length} of {children.length} failed
                </span>
                <Badge
                  variant="outline"
                  className={
                    children.every((c) => c.passed)
                      ? "bg-green-100 text-green-700 border-green-300"
                      : "bg-red-100 text-red-700 border-red-300"
                  }
                >
                  {children.every((c) => c.passed) ? "All OK" : "Issues found"}
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>

          {childrenOpen && (
            <CardContent className="pt-0 space-y-2">
              {children.map((child) => (
                <ChildRow key={child.id} child={child} />
              ))}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  )
}
