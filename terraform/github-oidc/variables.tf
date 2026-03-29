variable "aws_region" {
  type    = string
  default = "ap-northeast-2"
}

variable "terraform_allowed_branches" {
  type    = list(string)
  default = ["main"]
}

variable "deploy_allowed_branches" {
  type    = list(string)
  default = ["main"]
}

variable "github_oidc_thumbprints" {
  type    = list(string)
  default = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1b511abead59c6ce207077c0bf0e0043b1382612"
  ]
}

variable "enable_deploy_passrole" {
  type    = bool
  default = false
}
