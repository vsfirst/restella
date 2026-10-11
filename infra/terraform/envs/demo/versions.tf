terraform {
  required_version = "~> 1.16.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.68"
    }
  }

  # 버킷·리전 등은 backend.hcl(커밋 금지)로 넘긴다: terraform init -backend-config=backend.hcl
  backend "s3" {
    key = "demo/terraform.tfstate"
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = "restella"
      Environment = "demo"
      ManagedBy   = "terraform"
    }
  }
}
