package ru.billing.app.system;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/health")
public class SystemStatusController {

    private final SystemStatusService statusService;

    public SystemStatusController(SystemStatusService statusService) {
        this.statusService = statusService;
    }

    @GetMapping
    public SystemStatus health() {
        return statusService.getStatus();
    }
}

