package org.lowcoder.infra.event.datasource;

import java.util.Collection;

import org.lowcoder.infra.event.AbstractEvent;

import lombok.Getter;
import lombok.experimental.SuperBuilder;

@Getter
@SuperBuilder
public class DatasourcePermissionEvent extends AbstractEvent {

    private final String datasourceId;
    private final String name;
    private final String type;

    private final Collection<String> userIds;
    private final Collection<String> groupIds;
    private final String role;

    private final EventType eventType;
}
