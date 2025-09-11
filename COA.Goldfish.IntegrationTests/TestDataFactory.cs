namespace COA.Goldfish.IntegrationTests;

/// <summary>
/// Factory for creating realistic test data scenarios.
/// Eliminates "test123" hardcoded values and provides meaningful development workflows.
/// </summary>
public static class TestDataFactory
{
    private static readonly Random _random = new();

    /// <summary>
    /// Realistic development scenario types for comprehensive testing.
    /// </summary>
    public enum ScenarioType
    {
        ECommerce,
        SaaS,
        MachineLearning,
        DevOps,
        MobileApp,
        WebAPI,
        DataAnalytics,
        GameDevelopment
    }

    /// <summary>
    /// Generates realistic checkpoint data for a given development scenario.
    /// </summary>
    public static (string description, List<string> highlights, List<string> activeFiles) GenerateCheckpointData(string scenario = "random")
    {
        var scenarioType = ParseScenario(scenario);
        
        return scenarioType switch
        {
            ScenarioType.ECommerce => GenerateECommerceCheckpoint(),
            ScenarioType.SaaS => GenerateSaaSCheckpoint(),
            ScenarioType.MachineLearning => GenerateMLCheckpoint(),
            ScenarioType.DevOps => GenerateDevOpsCheckpoint(),
            ScenarioType.MobileApp => GenerateMobileCheckpoint(),
            ScenarioType.WebAPI => GenerateWebAPICheckpoint(),
            ScenarioType.DataAnalytics => GenerateDataAnalyticsCheckpoint(),
            ScenarioType.GameDevelopment => GenerateGameDevCheckpoint(),
            _ => GenerateRandomCheckpoint()
        };
    }

    /// <summary>
    /// Generates realistic todo items for a given development scenario.
    /// </summary>
    public static (string title, List<string> items) GenerateTodoData(string scenario = "random")
    {
        var scenarioType = ParseScenario(scenario);

        return scenarioType switch
        {
            ScenarioType.ECommerce => GenerateECommerceTodos(),
            ScenarioType.SaaS => GenerateSaaSTodos(),
            ScenarioType.MachineLearning => GenerateMLTodos(),
            ScenarioType.DevOps => GenerateDevOpsTodos(),
            ScenarioType.MobileApp => GenerateMobileTodos(),
            ScenarioType.WebAPI => GenerateWebAPITodos(),
            ScenarioType.DataAnalytics => GenerateDataAnalyticsTodos(),
            ScenarioType.GameDevelopment => GenerateGameDevTodos(),
            _ => GenerateRandomTodos()
        };
    }

    /// <summary>
    /// Generates realistic plan data for a given development scenario.
    /// </summary>
    public static (string title, string description, List<string> items, string category) GeneratePlanData(string scenario = "random")
    {
        var scenarioType = ParseScenario(scenario);

        return scenarioType switch
        {
            ScenarioType.ECommerce => GenerateECommercePlan(),
            ScenarioType.SaaS => GenerateSaaSPlan(),
            ScenarioType.MachineLearning => GenerateMLPlan(),
            ScenarioType.DevOps => GenerateDevOpsPlan(),
            ScenarioType.MobileApp => GenerateMobilePlan(),
            ScenarioType.WebAPI => GenerateWebAPIPlan(),
            ScenarioType.DataAnalytics => GenerateDataAnalyticsPlan(),
            ScenarioType.GameDevelopment => GenerateGameDevPlan(),
            _ => GenerateRandomPlan()
        };
    }

    private static ScenarioType ParseScenario(string scenario)
    {
        if (scenario == "random") return GetRandomScenario();

        return scenario.ToLowerInvariant() switch
        {
            "ecommerce" or "e-commerce" => ScenarioType.ECommerce,
            "saas" => ScenarioType.SaaS,
            "ml" or "machinelearning" or "ai" => ScenarioType.MachineLearning,
            "devops" or "infrastructure" => ScenarioType.DevOps,
            "mobile" or "app" => ScenarioType.MobileApp,
            "api" or "webapi" or "rest" => ScenarioType.WebAPI,
            "analytics" or "data" => ScenarioType.DataAnalytics,
            "game" or "gaming" => ScenarioType.GameDevelopment,
            _ => GetRandomScenario()
        };
    }

    private static ScenarioType GetRandomScenario()
    {
        var scenarios = Enum.GetValues<ScenarioType>();
        return scenarios[_random.Next(scenarios.Length)];
    }

    #region E-Commerce Scenarios

    private static (string, List<string>, List<string>) GenerateECommerceCheckpoint()
    {
        var features = new[]
        {
            ("Implemented Stripe payment integration with webhook handling", 
             new[] { "Added payment processing", "Configured webhook endpoints", "Implemented error handling" },
             new[] { "PaymentController.cs", "StripeWebhookHandler.cs", "PaymentService.cs" }),
            ("Completed product catalog refactoring with search optimization",
             new[] { "Optimized database queries", "Added full-text search", "Improved loading performance" },
             new[] { "ProductController.cs", "ProductService.cs", "SearchService.cs", "ProductIndex.cs" }),
            ("Added shopping cart persistence and session management",
             new[] { "Implemented cart state persistence", "Added session timeout handling", "Optimized cart operations" },
             new[] { "CartController.cs", "CartService.cs", "SessionMiddleware.cs" })
        };

        var feature = features[_random.Next(features.Length)];
        return (feature.Item1, feature.Item2.ToList(), feature.Item3.ToList());
    }

    private static (string, List<string>) GenerateECommerceTodos()
    {
        return ("E-Commerce Payment Integration", new List<string>
        {
            "Set up Stripe developer account and API keys",
            "Implement payment intent creation endpoint",
            "Add webhook handler for payment confirmations",
            "Create order fulfillment workflow",
            "Add payment failure retry logic",
            "Implement refund processing",
            "Add payment analytics dashboard"
        });
    }

    private static (string, string, List<string>, string) GenerateECommercePlan()
    {
        return (
            "Multi-vendor Marketplace Implementation",
            @"# Multi-vendor Marketplace Implementation

## Problem Statement
Current e-commerce platform only supports single-vendor sales. Need to expand to support multiple vendors with separate storefronts, commission tracking, and vendor analytics.

## Approach
1. Create vendor management system with approval workflow
2. Implement commission calculation and payment distribution
3. Add vendor-specific analytics and reporting
4. Create vendor onboarding process with documentation

## Success Criteria
- Support for 100+ concurrent vendors
- Automated commission calculations with 99.9% accuracy
- Vendor dashboard with real-time sales metrics
- Sub-5 second page load times for vendor storefronts",
            new List<string>
            {
                "Design vendor database schema and relationships",
                "Create vendor registration and approval system",
                "Implement commission calculation engine",
                "Build vendor dashboard with analytics",
                "Add multi-vendor payment splitting",
                "Create vendor-specific product management",
                "Implement vendor performance metrics"
            },
            "feature"
        );
    }

    #endregion

    #region SaaS Scenarios

    private static (string, List<string>, List<string>) GenerateSaaSCheckpoint()
    {
        var features = new[]
        {
            ("Implemented multi-tenant authentication with role-based access control",
             new[] { "Added tenant isolation", "Implemented RBAC system", "Created admin dashboard" },
             new[] { "AuthController.cs", "TenantService.cs", "RoleManager.cs", "AdminDashboard.cs" }),
            ("Added subscription billing integration with usage-based pricing",
             new[] { "Integrated Stripe subscriptions", "Implemented usage tracking", "Added billing webhooks" },
             new[] { "SubscriptionController.cs", "BillingService.cs", "UsageTracker.cs" }),
            ("Completed API rate limiting and monitoring implementation",
             new[] { "Added per-tenant rate limits", "Implemented monitoring dashboard", "Created alert system" },
             new[] { "RateLimitMiddleware.cs", "MonitoringService.cs", "AlertController.cs" })
        };

        var feature = features[_random.Next(features.Length)];
        return (feature.Item1, feature.Item2.ToList(), feature.Item3.ToList());
    }

    private static (string, List<string>) GenerateSaaSTodos()
    {
        return ("SaaS Multi-tenancy Implementation", new List<string>
        {
            "Design tenant isolation architecture",
            "Implement tenant-aware database connections",
            "Create tenant onboarding workflow",
            "Add subscription management interface",
            "Implement usage-based billing calculations",
            "Create tenant admin dashboard",
            "Add cross-tenant data protection"
        });
    }

    private static (string, string, List<string>, string) GenerateSaaSPlan()
    {
        return (
            "Enterprise SSO Integration",
            @"# Enterprise Single Sign-On Integration

## Problem Statement
Enterprise customers require SSO integration with their existing identity providers (SAML, OIDC). Current authentication system only supports local accounts.

## Approach
1. Implement SAML 2.0 and OpenID Connect protocols
2. Create identity provider configuration management
3. Add just-in-time user provisioning
4. Implement role mapping from external systems

## Success Criteria
- Support for major identity providers (Okta, Azure AD, Google Workspace)
- Seamless user experience with automatic role assignment
- Administrative interface for SSO configuration
- 99.9% authentication success rate",
            new List<string>
            {
                "Research SAML and OIDC protocol requirements",
                "Implement SAML assertion validation",
                "Create OpenID Connect integration",
                "Add identity provider configuration UI",
                "Implement just-in-time user provisioning",
                "Create role mapping configuration",
                "Add SSO audit logging and monitoring"
            },
            "architecture"
        );
    }

    #endregion

    #region Machine Learning Scenarios

    private static (string, List<string>, List<string>) GenerateMLCheckpoint()
    {
        var features = new[]
        {
            ("Completed model training pipeline with hyperparameter optimization",
             new[] { "Implemented automated hyperparameter tuning", "Added model validation framework", "Optimized training performance" },
             new[] { "ModelTrainer.py", "HyperparameterOptimizer.py", "ValidationFramework.py" }),
            ("Deployed real-time inference API with auto-scaling",
             new[] { "Created containerized inference service", "Added horizontal auto-scaling", "Implemented health checks" },
             new[] { "InferenceAPI.py", "DockerfileInference", "scaling-config.yaml" }),
            ("Implemented feature store with automated data pipeline",
             new[] { "Built feature extraction pipeline", "Added data quality monitoring", "Implemented feature versioning" },
             new[] { "FeatureStore.py", "DataPipeline.py", "FeatureValidator.py" })
        };

        var feature = features[_random.Next(features.Length)];
        return (feature.Item1, feature.Item2.ToList(), feature.Item3.ToList());
    }

    private static (string, List<string>) GenerateMLTodos()
    {
        return ("ML Model Deployment Pipeline", new List<string>
        {
            "Set up MLflow experiment tracking",
            "Implement automated model validation",
            "Create A/B testing framework for models",
            "Add model performance monitoring",
            "Implement automated retraining triggers",
            "Create model rollback mechanism",
            "Add feature drift detection"
        });
    }

    private static (string, string, List<string>, string) GenerateMLPlan()
    {
        return (
            "Real-time Recommendation Engine",
            @"# Real-time Recommendation Engine

## Problem Statement
Current batch recommendation system has 24-hour latency. Need real-time recommendations that adapt to user behavior within seconds.

## Approach
1. Implement streaming feature computation with Kafka
2. Create low-latency model serving infrastructure
3. Add real-time model updates with online learning
4. Implement A/B testing for recommendation strategies

## Success Criteria
- <100ms recommendation response time
- Real-time adaptation to user interactions
- 15% improvement in click-through rates
- Support for 10M+ recommendations per day",
            new List<string>
            {
                "Design streaming architecture with Kafka",
                "Implement real-time feature computation",
                "Create low-latency model serving API",
                "Add online learning capabilities",
                "Implement recommendation A/B testing",
                "Create performance monitoring dashboard",
                "Add recommendation quality metrics"
            },
            "feature"
        );
    }

    #endregion

    #region DevOps Scenarios

    private static (string, List<string>, List<string>) GenerateDevOpsCheckpoint()
    {
        var features = new[]
        {
            ("Implemented GitOps deployment pipeline with automated rollbacks",
             new[] { "Set up ArgoCD for GitOps", "Added automated rollback triggers", "Implemented blue-green deployments" },
             new[] { "deploy-pipeline.yaml", "rollback-config.yaml", "argocd-application.yaml" }),
            ("Added comprehensive monitoring with Prometheus and Grafana",
             new[] { "Deployed Prometheus monitoring stack", "Created custom Grafana dashboards", "Added alerting rules" },
             new[] { "prometheus-config.yaml", "grafana-dashboards/", "alert-rules.yaml" }),
            ("Completed infrastructure as code migration to Terraform",
             new[] { "Migrated all resources to Terraform", "Added state management", "Implemented resource tagging" },
             new[] { "infrastructure/", "terraform.tf", "variables.tf", "outputs.tf" })
        };

        var feature = features[_random.Next(features.Length)];
        return (feature.Item1, feature.Item2.ToList(), feature.Item3.ToList());
    }

    private static (string, List<string>) GenerateDevOpsTodos()
    {
        return ("Kubernetes Migration", new List<string>
        {
            "Design Kubernetes cluster architecture",
            "Create Docker images for all services",
            "Write Kubernetes manifests and Helm charts",
            "Set up ingress controller and load balancing",
            "Implement persistent volume management",
            "Add cluster monitoring and logging",
            "Create disaster recovery procedures"
        });
    }

    private static (string, string, List<string>, string) GenerateDevOpsPlan()
    {
        return (
            "Multi-Cloud Disaster Recovery",
            @"# Multi-Cloud Disaster Recovery Implementation

## Problem Statement
Current infrastructure is single-cloud dependent. Need disaster recovery across multiple cloud providers with automated failover.

## Approach
1. Implement infrastructure replication across AWS and GCP
2. Create automated backup and sync processes
3. Add health monitoring with automatic failover
4. Implement data consistency validation

## Success Criteria
- <15 minute recovery time objective (RTO)
- <1 minute recovery point objective (RPO)
- Automated failover with zero manual intervention
- 99.99% data consistency across clouds",
            new List<string>
            {
                "Design multi-cloud architecture",
                "Implement cross-cloud data replication",
                "Create automated backup strategies",
                "Add health monitoring and alerting",
                "Implement automatic failover logic",
                "Create disaster recovery testing procedures",
                "Add data consistency validation"
            },
            "architecture"
        );
    }

    #endregion

    #region Random Scenarios

    private static (string, List<string>, List<string>) GenerateRandomCheckpoint()
    {
        return GenerateECommerceCheckpoint(); // Fallback to e-commerce
    }

    private static (string, List<string>) GenerateRandomTodos()
    {
        return GenerateECommerceTodos(); // Fallback to e-commerce
    }

    private static (string, string, List<string>, string) GenerateRandomPlan()
    {
        return GenerateECommercePlan(); // Fallback to e-commerce
    }

    #endregion

    #region Additional Scenarios (Simplified implementations)

    private static (string, List<string>, List<string>) GenerateMobileCheckpoint()
    {
        return ("Implemented offline data synchronization with conflict resolution",
                new List<string> { "Added offline storage", "Implemented sync algorithm", "Added conflict resolution" },
                new List<string> { "OfflineManager.swift", "SyncService.swift", "ConflictResolver.swift" });
    }

    private static (string, List<string>) GenerateMobileTodos()
    {
        return ("Mobile App Push Notifications", new List<string>
        {
            "Set up Firebase Cloud Messaging",
            "Implement push notification handling",
            "Create notification categories and actions",
            "Add notification analytics tracking"
        });
    }

    private static (string, string, List<string>, string) GenerateMobilePlan()
    {
        return ("Cross-platform Mobile App", "Implement React Native app for iOS and Android", 
                new List<string> { "Set up React Native project", "Create shared components", "Add platform-specific features" }, 
                "feature");
    }

    private static (string, List<string>, List<string>) GenerateWebAPICheckpoint()
    {
        return ("Added GraphQL API with real-time subscriptions",
                new List<string> { "Implemented GraphQL schema", "Added subscription support", "Optimized query performance" },
                new List<string> { "GraphQLController.cs", "SubscriptionService.cs", "Schema.graphql" });
    }

    private static (string, List<string>) GenerateWebAPITodos()
    {
        return ("REST API Versioning", new List<string>
        {
            "Implement API versioning strategy",
            "Add backward compatibility layer",
            "Create version documentation",
            "Add deprecation warnings"
        });
    }

    private static (string, string, List<string>, string) GenerateWebAPIPlan()
    {
        return ("Microservices Architecture", "Migrate monolith to microservices architecture",
                new List<string> { "Identify service boundaries", "Implement service communication", "Add service discovery" },
                "architecture");
    }

    private static (string, List<string>, List<string>) GenerateDataAnalyticsCheckpoint()
    {
        return ("Implemented real-time analytics dashboard with streaming data",
                new List<string> { "Added streaming data pipeline", "Created real-time charts", "Optimized query performance" },
                new List<string> { "AnalyticsPipeline.py", "Dashboard.tsx", "QueryOptimizer.sql" });
    }

    private static (string, List<string>) GenerateDataAnalyticsTodos()
    {
        return ("Data Warehouse Implementation", new List<string>
        {
            "Design star schema for analytics",
            "Implement ETL pipelines",
            "Create data quality checks",
            "Add automated reporting"
        });
    }

    private static (string, string, List<string>, string) GenerateDataAnalyticsPlan()
    {
        return ("Real-time Analytics Platform", "Build comprehensive analytics platform with real-time insights",
                new List<string> { "Design data architecture", "Implement streaming analytics", "Create visualization layer" },
                "feature");
    }

    private static (string, List<string>, List<string>) GenerateGameDevCheckpoint()
    {
        return ("Implemented multiplayer networking with lag compensation",
                new List<string> { "Added client prediction", "Implemented server reconciliation", "Optimized network protocol" },
                new List<string> { "NetworkManager.cs", "LagCompensation.cs", "GameState.cs" });
    }

    private static (string, List<string>) GenerateGameDevTodos()
    {
        return ("Game Physics Engine", new List<string>
        {
            "Implement collision detection system",
            "Add rigid body dynamics",
            "Create particle system",
            "Optimize physics performance"
        });
    }

    private static (string, string, List<string>, string) GenerateGameDevPlan()
    {
        return ("Multiplayer Game Engine", "Create scalable multiplayer game engine with real-time networking",
                new List<string> { "Design network architecture", "Implement game state synchronization", "Add anti-cheat system" },
                "feature");
    }

    #endregion
}