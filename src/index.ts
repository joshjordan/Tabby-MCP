import { NgModule, OnDestroy } from '@angular/core';
import { AppService, ConfigProvider, ConfigService } from 'tabby-core';
import { Subscription } from 'rxjs';

// Services
import { McpService } from './services/mcpService';
import { McpLoggerService } from './services/mcpLogger.service';
import { McpConfigProvider } from './services/mcpConfigProvider';
import { DialogService } from './services/dialog.service';

// Tools
import { TerminalToolCategory } from './tools/terminal';
import { TabManagementToolCategory } from './tools/tabManagement';
import { SFTPToolCategory } from './tools/sftp';

/**
 * JJT: MCP module, reduced to a pure service module.
 *
 * This plugin builds with its own TypeScript 5.x toolchain (its deps use syntax
 * JJT's Angular 15 / TS 4.9 compiler can't parse), so it is NOT Ivy-compiled by
 * JJT. An @NgModule that imports TabbyCoreModule/CommonModule/etc. would drag
 * Tabby's AOT module graph into JIT compilation at load and fail
 * ("NgxFilesizeModule does not have a module def"). Since the tools only need
 * root-provided services (AppService, ConfigService, ProfilesService), we drop
 * all module imports and the settings-tab component and keep just the providers.
 * Server config comes from McpConfigProvider defaults.
 */
@NgModule({
    providers: [
        McpService,
        McpLoggerService,
        DialogService,
        TerminalToolCategory,
        TabManagementToolCategory,
        SFTPToolCategory,
        { provide: ConfigProvider, useClass: McpConfigProvider, multi: true }
    ]
})
export default class McpModule implements OnDestroy {
    private initialized = false;
    private appReadySubscription?: Subscription;
    private shutdownInProgress = false;

    constructor(
        private app: AppService,
        private config: ConfigService,
        private mcpService: McpService,
        private logger: McpLoggerService,
        private terminalTools: TerminalToolCategory,
        private tabManagementTools: TabManagementToolCategory,
        private sftpTools: SFTPToolCategory
    ) {
        this.logger.info('MCP Module loading...');

        // JJT: expose a lean, tab-focused toolset only. The terminal (exec) and
        // SFTP categories are intentionally not registered, and the allowlist in
        // McpService narrows tab_management down to the tab/group tools.
        this.mcpService.registerToolCategory(this.tabManagementTools);

        // Initialize server after app is ready
        this.appReadySubscription = this.app.ready$.subscribe(() => {
            this.config.ready$.toPromise().then(() => {
                this.initializeOnBoot();
            });
        });

        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', this.handleBeforeUnload);
            window.addEventListener('unload', this.handleBeforeUnload);
        }
    }

    /**
     * Initialize MCP server on application boot
     */
    private async initializeOnBoot(): Promise<void> {
        if (this.initialized) return;
        this.initialized = true;

        try {
            const mcpConfig = this.config.store.mcp;

            if (!mcpConfig) {
                this.logger.warn('MCP config not found, using defaults');
                return;
            }

            const startOnBoot = mcpConfig.startOnBoot !== false;

            if (startOnBoot) {
                this.logger.info('Starting MCP server on boot...');
                await this.mcpService.startServer(mcpConfig.port);
                this.logger.info(`MCP server started on port ${mcpConfig.port}`);
            } else {
                this.logger.info('MCP server auto-start disabled');
            }
        } catch (error) {
            this.logger.error('Failed to start MCP server on boot:', error);
        }
    }

    ngOnDestroy(): void {
        this.appReadySubscription?.unsubscribe();

        if (typeof window !== 'undefined') {
            window.removeEventListener('beforeunload', this.handleBeforeUnload);
            window.removeEventListener('unload', this.handleBeforeUnload);
        }

        this.shutdownServer('module destroy');
    }

    private handleBeforeUnload = (): void => {
        this.shutdownServer('window unload');
    };

    private shutdownServer(reason: string): void {
        if (this.shutdownInProgress) {
            return;
        }

        this.shutdownInProgress = true;
        this.logger.info(`Stopping MCP server due to ${reason}...`);

        this.mcpService.stopServerSync(reason);
    }
}

// Re-export types and services
export * from './services/mcpService';
export * from './services/mcpLogger.service';
export * from './services/mcpConfigProvider';
export * from './services/dialog.service';
export * from './tools/terminal';
export * from './tools/tabManagement';
export * from './tools/sftp';
export * from './types/types';
