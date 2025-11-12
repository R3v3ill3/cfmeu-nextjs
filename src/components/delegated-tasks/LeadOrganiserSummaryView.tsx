"use client";

import { useState, Fragment } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { LinksList } from "./LinksList";
import type { DelegatedTasksAnalyticsResponse } from "./DelegatedTasksDashboard";

interface LeadOrganiserSummaryViewProps {
  data: DelegatedTasksAnalyticsResponse;
  period: string;
  resourceType: string;
}

export function LeadOrganiserSummaryView({
  data,
  period,
  resourceType,
}: LeadOrganiserSummaryViewProps) {
  const [expandedSections, setExpandedSections] = useState<{
    universe: boolean;
    teams: boolean;
    myTeam: boolean;
  }>({
    universe: false,
    teams: false,
    myTeam: true,
  });
  const [selectedOrganiserId, setSelectedOrganiserId] = useState<string | null>(null);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div className="space-y-4">
      {/* Universe Stats */}
      {data.universe && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Universe Statistics</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleSection("universe")}
                className="gap-2"
              >
                {expandedSections.universe ? (
                  <>
                    Hide <ChevronUp className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Show <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          {expandedSections.universe && (
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Generated</div>
                  <div className="text-2xl font-bold">{data.universe.generated}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Submitted</div>
                  <div className="text-2xl font-bold text-green-600">
                    {data.universe.submitted}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Rate</div>
                  <div className="text-2xl font-bold">
                    {data.universe.submissionRate.toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Organisers</div>
                  <div className="text-2xl font-bold">
                    {data.universe.uniqueOrganisers}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Teams</div>
                  <div className="text-2xl font-bold">{data.universe.uniqueTeams}</div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* All Teams */}
      {data.teams && data.teams.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Teams</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleSection("teams")}
                className="gap-2"
              >
                {expandedSections.teams ? (
                  <>
                    Hide <ChevronUp className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Show <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          {expandedSections.teams && (
            <CardContent>
              <div className="space-y-3">
                {data.teams.map((team) => (
                  <div
                    key={team.leadOrganiserId}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{team.leadOrganiserName}</div>
                      <div className="text-sm text-muted-foreground">
                        {team.organiserCount} organisers
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Generated</div>
                        <div className="font-bold">{team.generated}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Submitted</div>
                        <div className="font-bold text-green-600">{team.submitted}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Rate</div>
                        <div className="font-bold">{team.submissionRate.toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* My Team */}
      {data.organisers && data.organisers.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>My Team Organisers</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleSection("myTeam")}
                className="gap-2"
              >
                {expandedSections.myTeam ? (
                  <>
                    Hide <ChevronUp className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Show <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          {expandedSections.myTeam && (
            <CardContent>
              <div className="space-y-3">
                {data.organisers.map((organiser) => (
                  <Fragment key={organiser.organiserId}>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{organiser.organiserName}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Generated</div>
                          <div className="font-bold">{organiser.generated}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Submitted</div>
                          <div className="font-bold text-green-600">
                            {organiser.submitted}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Rate</div>
                          <div className="font-bold">
                            {organiser.submissionRate.toFixed(1)}%
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedOrganiserId(
                              selectedOrganiserId === organiser.organiserId
                                ? null
                                : organiser.organiserId
                            );
                          }}
                        >
                          {selectedOrganiserId === organiser.organiserId
                            ? "Hide Links"
                            : "View Links"}
                        </Button>
                      </div>
                    </div>
                    {selectedOrganiserId === organiser.organiserId && (
                      <div className="mt-3 pt-3 border-t">
                        <LinksList
                          period={period}
                          resourceType={resourceType}
                          organiserId={organiser.organiserId}
                        />
                      </div>
                    )}
                  </Fragment>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

